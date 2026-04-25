"""
Merchant API views.
"""

import logging
import traceback

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q

from .models import Merchant, BankAccount
from .serializers import MerchantSerializer, MerchantBalanceSerializer, BankAccountSerializer
from apps.ledger.models import LedgerEntry

logger = logging.getLogger(__name__)


class MerchantViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for merchants.
    """
    queryset = Merchant.objects.all()
    serializer_class = MerchantSerializer
    
    def list(self, request, *args, **kwargs):
        """Override list to add error handling."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error listing merchants: {e}")
            logger.error(traceback.format_exc())
            return Response(
                {
                    'error': str(e),
                    'type': type(e).__name__,
                    'traceback': traceback.format_exc(),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to add error handling."""
        try:
            return super().retrieve(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error retrieving merchant: {e}")
            return Response(
                {'error': str(e), 'type': type(e).__name__},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    @action(detail=True, methods=['get'], url_path='balance')
    def balance(self, request, pk=None):
        try:
            merchant = self.get_object()
            
            available = LedgerEntry.get_available_balance(merchant.id)
            held = LedgerEntry.get_held_balance(merchant.id)
            
            aggregates = LedgerEntry.objects.filter(
                merchant=merchant
            ).aggregate(
                total_credits=Sum('amount_paise', filter=Q(entry_type='credit')),
                total_debits=Sum('amount_paise', filter=Q(entry_type='debit')),
            )
            
            data = {
                'merchant_id': merchant.id,
                'merchant_name': merchant.name,
                'available_balance_paise': available,
                'held_balance_paise': held,
                'total_credits_paise': aggregates['total_credits'] or 0,
                'total_debits_paise': abs(aggregates['total_debits'] or 0),
            }
            
            serializer = MerchantBalanceSerializer(data)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
            return Response(
                {'error': str(e), 'type': type(e).__name__},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    @action(detail=True, methods=['get'], url_path='bank-accounts')
    def bank_accounts(self, request, pk=None):
        try:
            merchant = self.get_object()
            accounts = BankAccount.objects.filter(merchant=merchant, is_active=True)
            serializer = BankAccountSerializer(accounts, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error getting bank accounts: {e}")
            return Response(
                {'error': str(e), 'type': type(e).__name__},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )