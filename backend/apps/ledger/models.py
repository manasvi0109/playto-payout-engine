"""
LedgerEntry model — the heart of our financial system.

KEY CONCEPT: Double-entry-inspired ledger
Instead of storing "balance = 5000" in a column, we store every transaction:
  +10000 (client payment received)
  -5000  (payout made)
  +2000  (another payment)
  ─────
  Balance = 7000 (calculated by summing all entries)

WHY THIS WAY?
1. Audit trail: Every rupee can be traced to a specific event
2. No race conditions on a balance column (two writes can't corrupt a sum)
3. Easy to debug: "why is balance X?" → look at the ledger
4. Financial compliance: regulators want transaction logs, not snapshots

SIGN CONVENTION:
- Positive amount = CREDIT (money coming IN to merchant's account)
- Negative amount = DEBIT (money going OUT — payouts, fees, etc.)
- Balance = SUM of all entries for a merchant

This is simpler than having a separate entry_type field with 'credit'/'debit' 
strings, because you can just do SUM(amount_paise) without CASE statements.
"""

from django.db import models
from django.db.models import Sum


class LedgerEntry(models.Model):
    """
    A single financial transaction in a merchant's ledger.
    
    Think of this as one line in a bank statement.
    """
    
    # Entry types for human readability
    ENTRY_TYPE_CHOICES = [
        ('credit', 'Credit'),  # Money in (positive amount)
        ('debit', 'Debit'),    # Money out (negative amount)
    ]
    
    merchant = models.ForeignKey(
        'merchants.Merchant',
        on_delete=models.CASCADE,
        related_name='ledger_entries',
        help_text="Which merchant this entry belongs to"
    )
    entry_type = models.CharField(
        max_length=10,
        choices=ENTRY_TYPE_CHOICES,
        help_text="'credit' for money in, 'debit' for money out"
    )
    amount_paise = models.BigIntegerField(
        help_text=(
            "Amount in paise (1/100 of a rupee). "
            "POSITIVE for credits, NEGATIVE for debits. "
            "e.g., ₹500.00 credit = +50000, ₹200.00 debit = -20000"
        )
    )
    description = models.CharField(
        max_length=500,
        help_text="Human-readable description of this transaction"
    )
    payout = models.ForeignKey(
        'payouts.Payout',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ledger_entries',
        help_text="If this entry is related to a payout, link it here"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']  # Newest first
        verbose_name_plural = 'Ledger entries'
        indexes = [
            # Index for fast balance calculation
            # This makes SUM queries on merchant's entries much faster
            models.Index(fields=['merchant', 'created_at']),
        ]
    
    def __str__(self):
        sign = '+' if self.amount_paise >= 0 else ''
        rupees = self.amount_paise / 100
        return f"{self.merchant.name}: {sign}₹{rupees:.2f} ({self.description})"
    
    @staticmethod
    def get_balance(merchant_id):
        """
        Calculate merchant's total balance from ledger.
        
        This is THE way to get balance — never store it in a column.
        
        Returns: integer (paise). 0 if no entries exist.
        
        SQL generated:
            SELECT COALESCE(SUM(amount_paise), 0) 
            FROM ledger_ledgerentry 
            WHERE merchant_id = %s;
        """
        result = LedgerEntry.objects.filter(
            merchant_id=merchant_id
        ).aggregate(
            total=Sum('amount_paise')
        )
        return result['total'] or 0
    
    @staticmethod
    def get_held_balance(merchant_id):
        """
        Calculate funds currently held for pending/processing payouts.
        
        When a payout is requested, we immediately create a DEBIT entry.
        This "holds" the funds. If the payout fails, we create a CREDIT
        entry to return the funds.
        
        Held balance = sum of debits linked to non-terminal payouts
        (pending or processing status)
        """
        from apps.payouts.models import Payout
        
        result = LedgerEntry.objects.filter(
            merchant_id=merchant_id,
            entry_type='debit',
            payout__status__in=['pending', 'processing']
        ).aggregate(
            total=Sum('amount_paise')
        )
        # This will be negative (debits are negative), so we negate it
        held = result['total'] or 0
        return abs(held)
    
    @staticmethod
    def get_available_balance(merchant_id):
        """
        Available balance = total balance (what they can still request payouts for)
        
        Note: Since debits for pending payouts are already in the ledger,
        the total balance already accounts for held funds.
        Available balance IS the total balance.
        """
        return LedgerEntry.get_balance(merchant_id)