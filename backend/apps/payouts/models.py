"""
Payout and IdempotencyKey models.

PAYOUT LIFECYCLE:
1. Merchant requests payout → status: PENDING
   - Debit ledger entry created (funds held)
   - Celery task queued

2. Celery picks it up → status: PROCESSING
   - Simulates bank API call

3. Bank responds:
   a. Success → status: COMPLETED (funds permanently gone)
   b. Failure → status: FAILED (credit ledger entry reverses the debit)
   c. No response → stays PROCESSING, retry later

STATE MACHINE:
    pending → processing → completed
                        → failed
    
    No other transitions allowed. Ever.
    
IDEMPOTENCY:
    Protects against duplicate payouts from network retries.
    Client sends Idempotency-Key header (UUID) with every request.
    If same key is seen again → return cached response instead of creating new payout.
"""

import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta


class Payout(models.Model):
    """A payout request from a merchant to their bank account."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),         # Just created, funds held
        ('processing', 'Processing'),   # Celery worker picked it up
        ('completed', 'Completed'),     # Bank confirmed success
        ('failed', 'Failed'),           # Bank rejected or max retries exceeded
    ]
    
    # Strict state machine: which transitions are legal
    ALLOWED_TRANSITIONS = {
        'pending': ['processing'],
        'processing': ['completed', 'failed'],
        'completed': [],  # Terminal state — no transitions out
        'failed': [],     # Terminal state — no transitions out
    }
    
    merchant = models.ForeignKey(
        'merchants.Merchant',
        on_delete=models.CASCADE,
        related_name='payouts',
    )
    bank_account = models.ForeignKey(
        'merchants.BankAccount',
        on_delete=models.CASCADE,
        related_name='payouts',
    )
    amount_paise = models.BigIntegerField(
        help_text="Payout amount in paise (always positive)"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True,  # We query by status often (e.g., find all pending)
    )
    attempt_count = models.IntegerField(
        default=0,
        help_text="How many times we've tried to process this payout"
    )
    idempotency_key = models.ForeignKey(
        'IdempotencyKey',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payouts',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the payout reached a terminal state (completed/failed)"
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['merchant', 'status']),
            models.Index(fields=['status', 'updated_at']),  # For retry query
        ]
    
    def __str__(self):
        rupees = self.amount_paise / 100
        return f"Payout #{self.id}: ₹{rupees:.2f} ({self.status}) - {self.merchant.name}"
    
    def transition_to(self, new_status):
        """
        Transition payout to a new status with state machine enforcement.
        
        This method:
        1. Checks if the transition is legal (state machine)
        2. Uses DB-level optimistic locking to prevent race conditions
        
        OPTIMISTIC LOCKING explained:
        Instead of SELECT FOR UPDATE (pessimistic — lock the row first),
        we do: UPDATE ... WHERE id=X AND status='current_status'
        
        If someone changed the status between our read and write,
        the WHERE clause won't match, updated_count = 0, and we know
        there was a concurrent modification.
        
        Returns: True if transition succeeded
        Raises: InvalidTransitionError, ConcurrentModificationError
        """
        # Step 1: Check state machine
        allowed = self.ALLOWED_TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise InvalidTransitionError(
                f"Cannot transition from '{self.status}' to '{new_status}'. "
                f"Allowed transitions from '{self.status}': {allowed}"
            )
        
        # Step 2: Atomic DB update with optimistic locking
        update_fields = {
            'status': new_status,
            'updated_at': timezone.now(),
        }
        
        # Set processed_at for terminal states
        if new_status in ('completed', 'failed'):
            update_fields['processed_at'] = timezone.now()
        
        # This UPDATE only succeeds if status hasn't changed since we read it
        updated_count = Payout.objects.filter(
            id=self.id,
            status=self.status  # This is the optimistic lock!
        ).update(**update_fields)
        
        if updated_count == 0:
            raise ConcurrentModificationError(
                f"Payout #{self.id} was modified by another process. "
                f"Expected status '{self.status}', but it's been changed."
            )
        
        # Update the in-memory instance to reflect DB change
        self.status = new_status
        if 'processed_at' in update_fields:
            self.processed_at = update_fields['processed_at']
        self.updated_at = update_fields['updated_at']
        
        return True


class IdempotencyKey(models.Model):
    """
    Ensures the same payout request isn't processed twice.
    
    HOW IT WORKS:
    1. Client sends POST /payouts/ with header: Idempotency-Key: <uuid>
    2. We check: does this key exist for this merchant?
       a. NO → create key (status=processing), process the request
       b. YES + status=processing → another request is in-flight, return 409
       c. YES + status=completed → return cached response (key.response_body)
    3. After request completes, update key: status=completed, response_body=response
    
    WHY per-merchant?
    - Different merchants could accidentally use same UUID
    - Scoping to merchant prevents cross-merchant conflicts
    
    WHY 24-hour expiry?
    - Can't store keys forever (DB would grow infinitely)
    - 24 hours is enough for any retry scenario
    - Expired keys can be cleaned up by a periodic task
    """
    
    STATUS_CHOICES = [
        ('processing', 'Processing'),  # Request is in-flight
        ('completed', 'Completed'),    # Request finished, response cached
    ]
    
    merchant = models.ForeignKey(
        'merchants.Merchant',
        on_delete=models.CASCADE,
        related_name='idempotency_keys',
    )
    key = models.UUIDField(
        help_text="Client-provided UUID for idempotency"
    )
    response_body = models.JSONField(
        null=True,
        blank=True,
        help_text="Cached response to return for duplicate requests"
    )
    response_status_code = models.IntegerField(
        null=True,
        blank=True,
        help_text="HTTP status code of the cached response"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='processing',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="When this key expires and can be reused"
    )
    
    class Meta:
        # A merchant can only use each key once
        unique_together = ('merchant', 'key')
        indexes = [
            models.Index(fields=['expires_at']),  # For cleanup query
        ]
    
    def __str__(self):
        return f"Key {self.key} ({self.status}) - {self.merchant.name}"
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    def save(self, *args, **kwargs):
        # Auto-set expires_at if not set
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)


# ============================================================
# Custom Exceptions
# ============================================================

class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class ConcurrentModificationError(Exception):
    """Raised when optimistic locking detects a concurrent modification."""
    pass


class InsufficientFundsError(Exception):
    """Raised when merchant doesn't have enough balance for a payout."""
    pass