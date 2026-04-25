"""
Root URL configuration.

All API endpoints are versioned under /api/v1/ for future-proofing.
If we ever need breaking changes, we can add /api/v2/ without breaking clients.
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.response import Response
from rest_framework.decorators import api_view


@api_view(['GET'])
def api_root(request):
    """
    API root — shows available endpoints.
    Helpful for evaluators to discover the API.
    """
    return Response({
        'message': 'Playto Payout Engine API',
        'version': 'v1',
        'endpoints': {
            'merchants': '/api/v1/merchants/',
            'merchant_balance': '/api/v1/merchants/{id}/balance/',
            'merchant_ledger': '/api/v1/merchants/{id}/ledger/',
            'merchant_bank_accounts': '/api/v1/merchants/{id}/bank-accounts/',
            'payouts': '/api/v1/payouts/',
            'payout_detail': '/api/v1/payouts/{id}/',
        }
    })


urlpatterns = [
    # Admin panel
    path('admin/', admin.site.urls),
    
    # API root
    path('api/v1/', api_root, name='api-root'),
    
    # Merchant endpoints
    path('api/v1/merchants/', include('apps.merchants.urls')),
    
    # Ledger endpoints (nested under merchants)
    path('api/v1/', include('apps.ledger.urls')),
    
    # Payout endpoints
    path('api/v1/payouts/', include('apps.payouts.urls')),
]