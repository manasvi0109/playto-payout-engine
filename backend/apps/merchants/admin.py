from django.contrib import admin
from .models import Merchant, BankAccount


@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'created_at')
    search_fields = ('name', 'email')


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'merchant', 'account_number', 'ifsc_code', 'is_active')
    list_filter = ('is_active',)