"""
Payout serializers.

Two serializers:
1. PayoutCreateSerializer — validates incoming POST request
2. PayoutSerializer — formats payout data for API response
"""

from rest_framework import serializers
from .models import Payout


class PayoutCreateSerializer(serializers.Serializer):
    """
    Validates the POST request body for creating a payout.
    
    NOT a ModelSerializer because we need custom validation
    and the creation logic is complex (ledger entries, idempotency, etc.)
    
    Expected request body:
    {
        "merchant_id": 1,
        "amount_paise": 50000,
        "bank_account_id": 1
    }
    """
    merchant_id = serializers.IntegerField(
        help_text="ID of the merchant requesting the payout"
    )
    amount_paise = serializers.IntegerField(
        min_value=100,  # Minimum payout: ₹1.00 (100 paise)
        help_text="Payout amount in paise. Minimum 100 (₹1.00)"
    )
    bank_account_id = serializers.IntegerField(
        help_text="ID of the bank account to send payout to"
    )
    
    def validate_amount_paise(self, value):
        """
        Extra validation for amount.
        
        Why separate validation?
        - min_value handles the minimum
        - This method handles business rules
        """
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        if value > 100_000_000:  # ₹10 lakh limit
            raise serializers.ValidationError(
                "Amount exceeds maximum payout limit of ₹10,00,000."
            )
        return value


class PayoutSerializer(serializers.ModelSerializer):
    """
    Serialize payout data for API responses.
    
    Used for:
    - POST response (newly created payout)
    - GET /payouts/ (list)
    - GET /payouts/{id}/ (detail)
    """
    amount_rupees = serializers.SerializerMethodField()
    merchant_name = serializers.CharField(source='merchant.name', read_only=True)
    bank_account_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Payout
        fields = [
            'id', 'merchant', 'merchant_name',
            'bank_account', 'bank_account_details',
            'amount_paise', 'amount_rupees',
            'status', 'attempt_count',
            'created_at', 'updated_at', 'processed_at',
        ]
        read_only_fields = fields  # All fields are read-only in responses
    
    def get_amount_rupees(self, obj):
        return obj.amount_paise / 100
    
    def get_bank_account_details(self, obj):
        return {
            'id': obj.bank_account.id,
            'account_number': f"****{obj.bank_account.account_number[-4:]}",
            'ifsc_code': obj.bank_account.ifsc_code,
            'nickname': obj.bank_account.nickname,
        }