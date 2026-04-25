"""
Celery tasks for payout processing.

TASKS:
1. process_payout(payout_id) — Process a single payout (simulate bank settlement)
2. retry_stuck_payouts() — Find and retry payouts stuck in 'processing'

SIMULATION:
Since we don't have a real bank API, we simulate outcomes:
- 70% → completed (bank accepted the transfer)
- 20% → failed (bank rejected — wrong account, limits, etc.)
- 10% → stuck (no response from bank — needs retry)
"""

import random
import logging
import time
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,  # Base delay for retries (seconds)
    acks_late=True,  # Acknowledge task AFTER completion (safer)
)
def process_payout(self, payout_id):
    """
    Process a single payout — simulate bank settlement.
    
    Parameters:
        payout_id: ID of the Payout record to process
    
    Lifecycle:
        1. Transition payout: pending → processing
        2. Simulate bank API call (random outcome)
        3. On success: transition to completed
        4. On failure: transition to failed + return funds
        5. On hang: do nothing (retry_stuck_payouts will handle it)
    
    bind=True: gives access to self (the task instance)
    acks_late=True: if worker crashes mid-task, the message goes back to queue
    """
    # Import here to avoid circular imports
    from .models import (
        Payout, InvalidTransitionError, 
        ConcurrentModificationError, InsufficientFundsError
    )
    from apps.ledger.models import LedgerEntry
    
    logger.info(f"Processing payout #{payout_id}")
    
    try:
        payout = Payout.objects.select_related('merchant', 'bank_account').get(id=payout_id)
    except Payout.DoesNotExist:
        logger.error(f"Payout #{payout_id} not found!")
        return {'status': 'error', 'message': f'Payout {payout_id} not found'}
    
    # ──────────────────────────────────────────────
    # STEP 1: Transition to PROCESSING
    # ──────────────────────────────────────────────
    try:
        payout.transition_to('processing')
        logger.info(f"Payout #{payout_id}: pending → processing")
    except InvalidTransitionError as e:
        # Already processing or in terminal state — skip
        logger.warning(f"Payout #{payout_id}: Cannot transition — {e}")
        return {'status': 'skipped', 'message': str(e)}
    except ConcurrentModificationError as e:
        # Another worker got to it first
        logger.warning(f"Payout #{payout_id}: Concurrent modification — {e}")
        return {'status': 'skipped', 'message': str(e)}
    
    # Increment attempt counter
    Payout.objects.filter(id=payout_id).update(
        attempt_count=payout.attempt_count + 1
    )
    
    # ──────────────────────────────────────────────
    # STEP 2: Simulate bank API call
    # ──────────────────────────────────────────────
    # In production, this would be an HTTP call to a banking API
    # like RazorpayX, Cashfree Payouts, or direct NEFT/IMPS
    
    # Simulate processing time (1-3 seconds)
    time.sleep(random.uniform(1, 3))
    
    # Determine outcome
    roll = random.random()  # Random float between 0 and 1
    
    if roll < 0.70:
        # ──────────────────────────────────────────────
        # 70% — SUCCESS: Bank accepted the transfer
        # ──────────────────────────────────────────────
        try:
            payout.transition_to('completed')
            logger.info(
                f"Payout #{payout_id}: COMPLETED — "
                f"₹{payout.amount_paise / 100:.2f} sent to "
                f"account ****{payout.bank_account.account_number[-4:]}"
            )
            return {
                'status': 'completed',
                'payout_id': payout_id,
                'amount_paise': payout.amount_paise,
            }
        except (InvalidTransitionError, ConcurrentModificationError) as e:
            logger.error(f"Payout #{payout_id}: Failed to complete — {e}")
            return {'status': 'error', 'message': str(e)}
    
    elif roll < 0.90:
        # ──────────────────────────────────────────────
        # 20% — FAILURE: Bank rejected the transfer
        # ──────────────────────────────────────────────
        # CRITICAL: We must return the held funds to the merchant
        # This MUST be atomic — either BOTH the status change and
        # fund return happen, or NEITHER happens
        try:
            with transaction.atomic():
                # Transition to failed
                payout.transition_to('failed')
                
                # Return funds: Create a CREDIT ledger entry
                # This reverses the DEBIT that was created when payout was requested
                LedgerEntry.objects.create(
                    merchant=payout.merchant,
                    entry_type='credit',
                    amount_paise=payout.amount_paise,  # POSITIVE (money returned)
                    description=f'Payout #{payout_id} failed - Funds returned',
                    payout=payout,
                )
                
                logger.info(
                    f"Payout #{payout_id}: FAILED — "
                    f"₹{payout.amount_paise / 100:.2f} returned to "
                    f"{payout.merchant.name}'s balance"
                )
            
            return {
                'status': 'failed',
                'payout_id': payout_id,
                'reason': 'Bank rejected the transfer (simulated)',
            }
        except (InvalidTransitionError, ConcurrentModificationError) as e:
            logger.error(f"Payout #{payout_id}: Failed to mark as failed — {e}")
            return {'status': 'error', 'message': str(e)}
    
    else:
        # ──────────────────────────────────────────────
        # 10% — STUCK: No response from bank
        # ──────────────────────────────────────────────
        # Don't change status — stays in 'processing'
        # retry_stuck_payouts periodic task will handle this
        logger.warning(
            f"Payout #{payout_id}: STUCK in processing — "
            f"bank did not respond (simulated). "
            f"Will be retried by periodic task."
        )
        return {
            'status': 'stuck',
            'payout_id': payout_id,
            'message': 'Simulated bank timeout — will retry',
        }


@shared_task
def retry_stuck_payouts():
    """
    Periodic task: Find payouts stuck in 'processing' and retry them.
    
    Runs every 30 seconds (configured in settings.CELERY_BEAT_SCHEDULE).
    
    A payout is "stuck" if:
    - Status is 'processing'
    - updated_at is more than 30 seconds ago
    - attempt_count < 3 (max retries)
    
    For payouts that exceeded max retries:
    - Mark as 'failed'
    - Return funds to merchant
    
    EXPONENTIAL BACKOFF:
    - Attempt 1: retry after 30 seconds
    - Attempt 2: retry after 60 seconds (30 * 2)
    - Attempt 3: retry after 120 seconds (30 * 4)
    This prevents hammering a potentially down bank API.
    """
    from .models import Payout, InvalidTransitionError, ConcurrentModificationError
    from apps.ledger.models import LedgerEntry
    
    now = timezone.now()
    
    # Find stuck payouts
    stuck_payouts = Payout.objects.filter(
        status='processing',
        updated_at__lt=now - timedelta(seconds=30),
    ).select_related('merchant', 'bank_account')
    
    if not stuck_payouts.exists():
        return {'status': 'ok', 'message': 'No stuck payouts found'}
    
    logger.info(f"Found {stuck_payouts.count()} stuck payouts")
    
    retried = 0
    failed = 0
    
    for payout in stuck_payouts:
        # Check exponential backoff
        # attempt_count=1 → wait 30s, attempt_count=2 → wait 60s, etc.
        backoff_seconds = 30 * (2 ** (payout.attempt_count - 1))
        if payout.updated_at > now - timedelta(seconds=backoff_seconds):
            # Not enough time has passed for this retry level
            continue
        
        if payout.attempt_count >= 3:
            # Max retries exceeded — fail the payout and return funds
            try:
                with transaction.atomic():
                    payout.transition_to('failed')
                    
                    LedgerEntry.objects.create(
                        merchant=payout.merchant,
                        entry_type='credit',
                        amount_paise=payout.amount_paise,
                        description=(
                            f'Payout #{payout.id} failed after {payout.attempt_count} '
                            f'attempts - Funds returned'
                        ),
                        payout=payout,
                    )
                    
                    failed += 1
                    logger.info(
                        f"Payout #{payout.id}: Max retries exceeded, "
                        f"marked as FAILED, funds returned"
                    )
            except (InvalidTransitionError, ConcurrentModificationError) as e:
                logger.error(f"Payout #{payout.id}: Could not fail — {e}")
        else:
            # Retry: reset to pending and requeue
            # We transition back by directly updating status
            # (Our state machine doesn't allow processing → pending,
            #  so we use a direct update for retries — this is intentional)
            Payout.objects.filter(
                id=payout.id,
                status='processing',
            ).update(
                status='pending',
                updated_at=now,
            )
            payout.refresh_from_db()
            
            # Requeue the Celery task
            process_payout.delay(payout.id)
            retried += 1
            logger.info(
                f"Payout #{payout.id}: Stuck, retrying "
                f"(attempt {payout.attempt_count + 1}/3)"
            )
    
    result = {
        'status': 'ok',
        'stuck_found': stuck_payouts.count(),
        'retried': retried,
        'failed': failed,
    }
    logger.info(f"Retry stuck payouts result: {result}")
    return result 