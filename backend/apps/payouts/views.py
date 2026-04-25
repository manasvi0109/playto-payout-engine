"""
Payout API views — the core of the payout engine.

This file contains the most critical code in the entire project:
1. Concurrency control (SELECT FOR UPDATE NOWAIT)
2. Idempotency (duplicate request handling)
3. Atomic ledger operations (no partial state)

Every line here is intentional. Read the comments carefully.
"""

import logging
import uuid
from datetime import timedelta

from django.db import transaction, OperationalError
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from apps.merchants.models import Merchant, BankAccount
from apps.ledger.models import LedgerEntry
from .models import Payout, IdempotencyKey, InsufficientFundsError
from .serializers import PayoutCreateSerializer, PayoutSerializer

logger = logging.getLogger(__name__)


class PayoutPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class PayoutCreateView(APIView):
    """
    POST /api/v1/payouts/
    
    Creates a new payout request.
    
    Required headers:
    - Idempotency-Key: <uuid>  (prevents duplicate payouts)
    
    Required body:
    {
        "merchant_id": 1,
        "amount_paise": 50000,
        "bank_account_id": 1
    }
    
    This endpoint does THREE critical things atomically:
    1. Checks idempotency (have we seen this request before?)
    2. Checks balance with row locking (can merchant afford this?)
    3. Creates payout + debit ledger entry (hold the funds)
    
    If ANY of these fail, NOTHING is committed to the database.
    """
    
    def post(self, request):
        # ──────────────────────────────────────────────
        # STEP 1: Validate the Idempotency-Key header
        # ──────────────────────────────────────────────
        idempotency_key_str = request.headers.get('Idempotency-Key')
        
        if not idempotency_key_str:
            return Response(
                {'error': 'Idempotency-Key header is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Validate it's a proper UUID
        try:
            idempotency_uuid = uuid.UUID(idempotency_key_str)
        except ValueError:
            return Response(
                {'error': 'Idempotency-Key must be a valid UUID.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # ──────────────────────────────────────────────
        # STEP 2: Validate request body
        # ──────────────────────────────────────────────
        serializer = PayoutCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Validation failed', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        merchant_id = serializer.validated_data['merchant_id']
        amount_paise = serializer.validated_data['amount_paise']
        bank_account_id = serializer.validated_data['bank_account_id']
        
        # ──────────────────────────────────────────────
        # STEP 3: Verify merchant and bank account exist
        # ──────────────────────────────────────────────
        try:
            merchant = Merchant.objects.get(id=merchant_id)
        except Merchant.DoesNotExist:
            return Response(
                {'error': f'Merchant with id {merchant_id} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        try:
            bank_account = BankAccount.objects.get(
                id=bank_account_id,
                merchant=merchant,
                is_active=True,
            )
        except BankAccount.DoesNotExist:
            return Response(
                {'error': f'Active bank account {bank_account_id} not found for this merchant.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        # ──────────────────────────────────────────────
        # STEP 4: Check idempotency
        # ──────────────────────────────────────────────
        # Check if this key has been used before (for this merchant)
        try:
            existing_key = IdempotencyKey.objects.get(
                merchant=merchant,
                key=idempotency_uuid,
            )
            
            # Key exists! Check if it's expired
            if existing_key.is_expired:
                # Expired keys are treated as new (clean up and proceed)
                existing_key.delete()
                # Fall through to create new key below
                raise IdempotencyKey.DoesNotExist()
            
            # Key exists and is NOT expired
            if existing_key.status == 'processing':
                # First request is still in-flight
                # Return 409 Conflict — tell client to wait and retry
                return Response(
                    {
                        'error': 'A request with this idempotency key is currently being processed.',
                        'idempotency_key': str(idempotency_uuid),
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            
            if existing_key.status == 'completed':
                # Request was already processed — return cached response
                logger.info(
                    f"Idempotency hit: key={idempotency_uuid}, "
                    f"merchant={merchant_id}, returning cached response"
                )
                return Response(
                    existing_key.response_body,
                    status=existing_key.response_status_code or 201,
                )
        
        except IdempotencyKey.DoesNotExist:
            # Key doesn't exist — this is a new request. Continue.
            pass
        
        # ──────────────────────────────────────────────
        # STEP 5: THE CRITICAL SECTION
        # Create idempotency key, check balance, create payout
        # ALL inside one atomic transaction
        # ──────────────────────────────────────────────
        try:
            with transaction.atomic():
                # 5a. Create idempotency key (status=processing)
                # If another request with same key arrives NOW, it'll get
                # unique_together violation → handled by the try/except above
                # on next request, it'll see status=processing → 409
                idem_key = IdempotencyKey.objects.create(
                    merchant=merchant,
                    key=idempotency_uuid,
                    status='processing',
                    expires_at=timezone.now() + timedelta(hours=24),
                )
                
                # 5b. Lock merchant's ledger entries and calculate balance
                #
                # SELECT FOR UPDATE NOWAIT explained:
                # - SELECT FOR UPDATE: "lock these rows, nobody else can 
                #   modify them until my transaction completes"
                # - NOWAIT: "if rows are already locked by another transaction,
                #   DON'T wait — immediately raise an error"
                #
                # WHY NOWAIT instead of waiting?
                # - In a fintech system, we want FAIL FAST
                # - Better to reject immediately than queue up requests
                # - The client can retry after a brief delay
                # - Prevents deadlocks from accumulating
                #
                # WHAT GETS LOCKED?
                # All ledger entries for this merchant. This means only ONE
                # payout request per merchant can be in the critical section
                # at any time. Other requests fail immediately.
                balance = (
                    LedgerEntry.objects
                    .select_for_update(nowait=True)
                    .filter(merchant=merchant)
                    .aggregate(total=Sum('amount_paise'))['total'] or 0
                )
                
                # 5c. Check if merchant can afford this payout
                if balance < amount_paise:
                    # Not enough funds — clean up idempotency key and reject
                    idem_key.delete()
                    return Response(
                        {
                            'error': 'Insufficient funds.',
                            'available_balance_paise': balance,
                            'requested_amount_paise': amount_paise,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                # 5d. Create the payout record
                payout = Payout.objects.create(
                    merchant=merchant,
                    bank_account=bank_account,
                    amount_paise=amount_paise,
                    status='pending',
                    idempotency_key=idem_key,
                )
                
                # 5e. Create debit ledger entry (HOLD the funds)
                # This is NEGATIVE because it's money going OUT
                LedgerEntry.objects.create(
                    merchant=merchant,
                    entry_type='debit',
                    amount_paise=-amount_paise,  # NEGATIVE!
                    description=f'Payout #{payout.id} - Funds held',
                    payout=payout,
                )
                
                # 5f. Serialize the response
                response_data = PayoutSerializer(payout).data
                
                # 5g. Cache the response in idempotency key
                idem_key.response_body = response_data
                idem_key.response_status_code = 201
                idem_key.status = 'completed'
                idem_key.save()
                
                logger.info(
                    f"Payout created: id={payout.id}, merchant={merchant_id}, "
                    f"amount={amount_paise} paise, status=pending"
                )
            
            # ──────────────────────────────────────────────
            # STEP 6: Queue Celery task (OUTSIDE transaction)
            # ──────────────────────────────────────────────
            # Try to queue Celery task, but don't fail if Redis is unavailable
            # On Render free tier, we might not have Celery workers
            try:
                from .tasks import process_payout
                process_payout.delay(payout.id)
                logger.info(f"Celery task queued for payout #{payout.id}")
            except Exception as celery_error:
                logger.warning(
                    f"Could not queue Celery task for payout #{payout.id}: {celery_error}. "
                    f"Payout will stay in 'pending' until Celery is available."
                )
        except OperationalError as e:
            # ──────────────────────────────────────────────
            # NOWAIT lock failure
            # Another transaction has locked this merchant's ledger
            # This is the EXPECTED behavior for concurrent requests
            # ──────────────────────────────────────────────
            error_str = str(e).lower()
            if 'could not obtain lock' in error_str or 'nowait' in error_str:
                logger.warning(
                    f"Concurrent payout attempt blocked: merchant={merchant_id}, "
                    f"amount={amount_paise} paise"
                )
                return Response(
                    {
                        'error': 'Another payout is being processed for this merchant. Please retry.',
                        'retry_after_seconds': 2,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            # Some other DB error — re-raise
            logger.error(f"Database error during payout creation: {e}")
            raise
        
        except Exception as e:
            # Clean up idempotency key if something unexpected fails
            IdempotencyKey.objects.filter(
                merchant=merchant,
                key=idempotency_uuid,
                status='processing',
            ).delete()
            logger.error(f"Unexpected error during payout creation: {e}")
            raise


class PayoutListView(ListAPIView):
    """
    GET /api/v1/payouts/?merchant_id=1
    
    Lists payouts, optionally filtered by merchant.
    """
    serializer_class = PayoutSerializer
    pagination_class = PayoutPagination
    
    def get_queryset(self):
        queryset = Payout.objects.select_related('merchant', 'bank_account')
        
        # Optional filter by merchant_id
        merchant_id = self.request.query_params.get('merchant_id')
        if merchant_id:
            queryset = queryset.filter(merchant_id=merchant_id)
        
        # Optional filter by status
        payout_status = self.request.query_params.get('status')
        if payout_status:
            queryset = queryset.filter(status=payout_status)
        
        return queryset


class PayoutDetailView(RetrieveAPIView):
    """
    GET /api/v1/payouts/{id}/
    
    Get a single payout by ID.
    """
    serializer_class = PayoutSerializer
    queryset = Payout.objects.select_related('merchant', 'bank_account')