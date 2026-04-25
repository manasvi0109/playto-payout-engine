from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# DRF Router automatically creates URL patterns for ViewSets
# This creates:
#   GET /               → MerchantViewSet.list()
#   GET /{pk}/          → MerchantViewSet.retrieve()
#   GET /{pk}/balance/  → MerchantViewSet.balance()
#   GET /{pk}/bank-accounts/ → MerchantViewSet.bank_accounts()
router = DefaultRouter()
router.register(r'', views.MerchantViewSet, basename='merchant')

urlpatterns = [
    path('', include(router.urls)),
]