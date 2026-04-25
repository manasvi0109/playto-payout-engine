"""
Payout API views — the core of the payout engine.
"""

import logging
import uuid
from datetime import timedelta

from django.db import transaction, OperationalError
from django.db.models import Sum
from django.utils import timezone
from django.conf import settings as django_settings
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
    
    Creates a new payout request with concurrency control + idempotency.
    """
    
    def post(self, request):
        # ──────────────────────────────────────────────
        # STEP 1: Validate Idempotency-Key header
        # ──────────────────────────────────────────────
        idempotency_key_str = request.headers.get('Idempotency-Key')
        
        if not idempotency_key_str:
            return Response(
                {'error': 'Idempotency-Key header is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
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
        try:
            existing_key = IdempotencyKey.objects.get(
                merchant=merchant,
                key=idempotency_uuid,
            )
            
            if existing_key.is_expired:
                existing_key.delete()
                raise IdempotencyKey.DoesNotExist()
            
            if existing_key.status == 'processing':
                return Response(
                    {
                        'error': 'A request with this idempotency key is currently being processed.',
                        'idempotency_key': str(idempotency_uuid),
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            
            if existing_key.status == 'completed':
                logger.info(f"Idempotency hit: key={idempotency_uuid}, merchant={merchant_id}")
                return Response(
                    existing_key.response_body,
                    status=existing_key.response_status_code or 201,
                )
        
        except IdempotencyKey.DoesNotExist:
            pass
        
        # ──────────────────────────────────────────────
        # STEP 5: THE CRITICAL SECTION
        # ──────────────────────────────────────────────
        try:
            with transaction.atomic():
                idem_key = IdempotencyKey.objects.create(
                    merchant=merchant,
                    key=idempotency_uuid,
                    status='processing',
                    expires_at=timezone.now() + timedelta(hours=24),
                )
                
                # Lock ledger entries and calculate balance
                balance = (
                    LedgerEntry.objects
                    .select_for_update(nowait=True)
                    .filter(merchant=merchant)
                    .aggregate(total=Sum('amount_paise'))['total'] or 0
                )
                
                if balance < amount_paise:
                    idem_key.delete()
                    return Response(
                        {
                            'error': 'Insufficient funds.',
                            'available_balance_paise': balance,
                            'requested_amount_paise': amount_paise,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                payout = Payout.objects.create(
                    merchant=merchant,
                    bank_account=bank_account,
                    amount_paise=amount_paise,
                    status='pending',
                    idempotency_key=idem_key,
                )
                
                LedgerEntry.objects.create(
                    merchant=merchant,
                    entry_type='debit',
                    amount_paise=-amount_paise,
                    description=f'Payout #{payout.id} - Funds held',
                    payout=payout,
                )
                
                response_data = PayoutSerializer(payout).data
                
                idem_key.response_body = response_data
                idem_key.response_status_code = 201
                idem_key.status = 'completed'
                idem_key.save()
                
                logger.info(
                    f"Payout created: id={payout.id}, merchant={merchant_id}, "
                    f"amount={amount_paise} paise"
                )
            
            # ──────────────────────────────────────────────
            # STEP 6: Process payout (Celery or eager)
            # ──────────────────────────────────────────────
            try:
                from .tasks import process_payout
                
                if getattr(django_settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                    # EAGER MODE: process synchronously
                    logger.info(f"Processing payout #{payout.id} eagerly (sync mode)")
                    try:
                        process_payout(payout.id)
                        # Refresh from DB to get updated status
                        payout.refresh_from_db()
                        response_data = PayoutSerializer(payout).data
                        # Update idempotency cache with final state
                        idem_key.response_body = response_data
                        idem_key.save(update_fields=['response_body'])
                        logger.info(f"Payout #{payout.id} processed eagerly → {payout.status}")
                    except Exception as eager_err:
                        logger.warning(f"Eager processing error for payout #{payout.id}: {eager_err}")
                else:
                    # NORMAL MODE: queue to Celery worker
                    process_payout.delay(payout.id)
                    logger.info(f"Celery task queued for payout #{payout.id}")
            except Exception as celery_error:
                logger.warning(
                    f"Could not process payout #{payout.id}: {celery_error}. "
                    f"Payout stays in 'pending'."
                )
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        except OperationalError as e:
            error_str = str(e).lower()
            if 'could not obtain lock' in error_str or 'nowait' in error_str:
                logger.warning(
                    f"Concurrent payout attempt blocked: merchant={merchant_id}"
                )
                return Response(
                    {
                        'error': 'Another payout is being processed for this merchant. Please retry.',
                        'retry_after_seconds': 2,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            logger.error(f"Database error during payout creation: {e}")
            raise
        
        except Exception as e:
            IdempotencyKey.objects.filter(
                merchant=merchant,
                key=idempotency_uuid,
                status='processing',
            ).delete()
            logger.error(f"Unexpected error during payout creation: {e}")
            raise


class PayoutListView(ListAPIView):
    """
    GET /api/v1/payouts/list/?merchant_id=1
    """
    serializer_class = PayoutSerializer
    pagination_class = PayoutPagination
    
    def get_queryset(self):
        queryset = Payout.objects.select_related('merchant', 'bank_account')
        
        merchant_id = self.request.query_params.get('merchant_id')
        if merchant_id:
            queryset = queryset.filter(merchant_id=merchant_id)
        
        payout_status = self.request.query_params.get('status')
        if payout_status:
            queryset = queryset.filter(status=payout_status)
        
        return queryset


class PayoutDetailView(RetrieveAPIView):
    """
    GET /api/v1/payouts/{id}/
    """
    serializer_class = PayoutSerializer
    queryset = Payout.objects.select_related('merchant', 'bank_account')