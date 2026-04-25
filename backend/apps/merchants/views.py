"""
Merchant API views.

Endpoints:
- GET /api/v1/merchants/              → List all merchants
- GET /api/v1/merchants/{id}/         → Single merchant detail
- GET /api/v1/merchants/{id}/balance/ → Balance summary
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q

from .models import Merchant, BankAccount
from .serializers import MerchantSerializer, MerchantBalanceSerializer, BankAccountSerializer
from apps.ledger.models import LedgerEntry


class MerchantViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for merchants. Read-only because merchants are pre-seeded.
    
    ReadOnlyModelViewSet provides:
    - list() → GET /merchants/          (all merchants)
    - retrieve() → GET /merchants/{id}/ (single merchant)
    
    We add a custom action for balance.
    """
    queryset = Merchant.objects.all()
    serializer_class = MerchantSerializer
    
    @action(detail=True, methods=['get'], url_path='balance')
    def balance(self, request, pk=None):
        """
        GET /api/v1/merchants/{id}/balance/
        
        Returns detailed balance breakdown.
        
        @action(detail=True) means this operates on a SINGLE merchant (has pk).
        If detail=False, it would operate on the collection (no pk).
        """
        merchant = self.get_object()  # Gets merchant by pk, 404 if not found
        
        # Calculate balances
        available = LedgerEntry.get_available_balance(merchant.id)
        held = LedgerEntry.get_held_balance(merchant.id)
        
        # Calculate total credits and debits separately
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
    
    @action(detail=True, methods=['get'], url_path='bank-accounts')
    def bank_accounts(self, request, pk=None):
        """
        GET /api/v1/merchants/{id}/bank-accounts/
        
        List all bank accounts for a merchant.
        """
        merchant = self.get_object()
        accounts = BankAccount.objects.filter(merchant=merchant, is_active=True)
        serializer = BankAccountSerializer(accounts, many=True)
        return Response(serializer.data)