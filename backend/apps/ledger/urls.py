from django.urls import path
from . import views

urlpatterns = [
    # This URL is nested: /merchants/{merchant_id}/ledger/
    # We'll register it in the main urls.py
    path(
        'merchants/<int:merchant_id>/ledger/',
        views.MerchantLedgerView.as_view(),
        name='merchant-ledger',
    ),
]