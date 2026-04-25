"""
Ledger API views.

Endpoints:
- GET /api/v1/merchants/{merchant_id}/ledger/ → Paginated ledger entries
"""

from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from .models import LedgerEntry
from .serializers import LedgerEntrySerializer


class LedgerPagination(PageNumberPagination):
    """
    Custom pagination for ledger entries.
    
    Returns 20 entries per page by default.
    Client can request different page sizes up to 100:
    GET /ledger/?page=2&page_size=50
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class MerchantLedgerView(generics.ListAPIView):
    """
    GET /api/v1/merchants/{merchant_id}/ledger/
    
    Lists all ledger entries for a specific merchant.
    Newest entries first (ordering defined in model Meta).
    
    ListAPIView provides:
    - GET with pagination
    - Automatic serialization
    - No POST/PUT/DELETE (read-only)
    """
    serializer_class = LedgerEntrySerializer
    pagination_class = LedgerPagination
    
    def get_queryset(self):
        """
        Filter ledger entries by merchant_id from URL.
        
        self.kwargs contains URL parameters.
        /api/v1/merchants/3/ledger/ → self.kwargs['merchant_id'] = '3'
        """
        merchant_id = self.kwargs['merchant_id']
        return LedgerEntry.objects.filter(
            merchant_id=merchant_id
        ).select_related('payout')  # JOIN with payout table to avoid N+1 queries