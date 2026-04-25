from django.contrib import admin
from .models import Payout, IdempotencyKey


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ('id', 'merchant', 'amount_paise', 'status', 'attempt_count', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('created_at', 'updated_at', 'processed_at')


@admin.register(IdempotencyKey)
class IdempotencyKeyAdmin(admin.ModelAdmin):
    list_display = ('id', 'merchant', 'key', 'status', 'created_at', 'expires_at')
    list_filter = ('status',)