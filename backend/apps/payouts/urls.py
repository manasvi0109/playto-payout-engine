from django.urls import path
from . import views

urlpatterns = [
    # POST - Create payout (with idempotency)
    # GET - List payouts (with optional ?merchant_id=X filter)
    path('', views.PayoutCreateView.as_view(), name='payout-create'),
    path('list/', views.PayoutListView.as_view(), name='payout-list'),
    path('<int:pk>/', views.PayoutDetailView.as_view(), name='payout-detail'),
]