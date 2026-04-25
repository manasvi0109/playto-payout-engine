from rest_framework import serializers
from .models import Merchant, BankAccount
from apps.ledger.models import LedgerEntry


class BankAccountSerializer(serializers.ModelSerializer):
    """Serialize bank account data for API responses."""
    
    class Meta:
        model = BankAccount
        fields = ['id', 'account_number', 'ifsc_code', 'nickname', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class MerchantSerializer(serializers.ModelSerializer):
    """Serialize merchant data with computed balance fields."""
    
    available_balance_paise = serializers.SerializerMethodField()
    held_balance_paise = serializers.SerializerMethodField()
    bank_accounts = BankAccountSerializer(many=True, read_only=True)
    
    class Meta:
        model = Merchant
        fields = [
            'id', 'name', 'email',
            'available_balance_paise',
            'held_balance_paise',
            'bank_accounts',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_available_balance_paise(self, obj):
        """
        Available balance = total ledger sum.
        Since pending payout debits are already in the ledger,
        the available balance already excludes held funds.
        """
        return LedgerEntry.get_available_balance(obj.id)
    
    def get_held_balance_paise(self, obj):
        """
        Held balance = funds locked for pending/processing payouts.
        This is informational — shows how much is "in transit".
        """
        return LedgerEntry.get_held_balance(obj.id)


class MerchantBalanceSerializer(serializers.Serializer):
    """
    Dedicated balance endpoint response.
    
    Why a separate serializer? The balance endpoint is called frequently
    (polling every 5 seconds from frontend). This serializer only computes
    balance, not full merchant data — lighter and faster.
    """
    merchant_id = serializers.IntegerField()
    merchant_name = serializers.CharField()
    available_balance_paise = serializers.IntegerField()
    held_balance_paise = serializers.IntegerField()
    total_credits_paise = serializers.IntegerField()
    total_debits_paise = serializers.IntegerField()