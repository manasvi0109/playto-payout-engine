from rest_framework import serializers
from .models import LedgerEntry


class LedgerEntrySerializer(serializers.ModelSerializer):
    """
    Serialize ledger entries for API response.
    
    Adds computed fields:
    - amount_rupees: human-readable amount (for display)
    - payout_id: the linked payout ID (if any)
    """
    amount_rupees = serializers.SerializerMethodField()
    payout_id = serializers.IntegerField(source='payout.id', default=None, read_only=True)
    
    class Meta:
        model = LedgerEntry
        fields = [
            'id', 'merchant', 'entry_type', 'amount_paise',
            'amount_rupees', 'description', 'payout_id', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_amount_rupees(self, obj):
        """Convert paise to rupees for display. Backend always stores paise."""
        return obj.amount_paise / 100