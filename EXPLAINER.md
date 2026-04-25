# EXPLAINER.md — Playto Payout Engine

**Author:** Manasvi  
**Role:** Founding Engineer Assignment

---

## 1. The Ledger

### Balance Calculation Query

```python
# apps/ledger/models.py — LedgerEntry.get_balance()

@staticmethod
def get_balance(merchant_id):
    result = LedgerEntry.objects.filter(
        merchant_id=merchant_id
    ).aggregate(
        total=Sum('amount_paise')
    )
    return result['total'] or 0
```

**SQL this generates:**

```sql
SELECT COALESCE(SUM(amount_paise), 0) 
FROM ledger_ledgerentry 
WHERE merchant_id = %s;
```

### Why I modeled credits and debits this way

I use a single `amount_paise` column where credits are **positive integers** and debits are **negative integers**. Balance is always a single `SUM()` — no CASE statements, no separate queries.

**Why not a stored balance column on Merchant?**

If two concurrent requests both read `balance = 100000` from a column, both think they can deduct 60000, both write `balance = 40000`, and the merchant just got ₹600 for free. With a ledger, the balance is always derived from the full transaction history — there's no single value to corrupt.

**Why `BigIntegerField` in paise, not `DecimalField` or `Float`?**

- `float`: `0.1 + 0.2 = 0.30000000000000004` — unacceptable for money
- `Decimal`: Works, but adds complexity. Paise as integers is simpler and what actual payment processors use
- `BigInteger`: ₹500.00 = 50000 paise. Integer arithmetic is exact. No rounding errors. Ever.

**Why this matters:** Every entry in the ledger is an immutable fact — "₹500 was credited on April 23 for invoice #X". You can always reconstruct the balance, audit it, and answer "why is the balance ₹36,500?" by looking at the ledger. A stored balance column can't answer that question.

---

## 2. The Lock

### Exact code that prevents overdraw

```python
# apps/payouts/views.py — PayoutCreateView.post(), inside STEP 5

with transaction.atomic():
    balance = (
        LedgerEntry.objects
        .select_for_update(nowait=True)
        .filter(merchant=merchant)
        .aggregate(total=Sum('amount_paise'))['total'] or 0
    )
    
    if balance < amount_paise:
        idem_key.delete()
        return Response(
            {'error': 'Insufficient funds.', ...},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    payout = Payout.objects.create(
        merchant=merchant,
        bank_account=bank_account,
        amount_paise=amount_paise,
        status='pending',
        idempotency_key=idem_key,
    )
    
    LedgerEntry.objects.create(
        merchant=merchant,
        entry_type='debit',
        amount_paise=-amount_paise,  # NEGATIVE
        description=f'Payout #{payout.id} - Funds held',
        payout=payout,
    )
```

### What database primitive does it rely on?

**PostgreSQL `SELECT ... FOR UPDATE NOWAIT`**

```sql
BEGIN;
SELECT * FROM ledger_ledgerentry 
WHERE merchant_id = 1 
FOR UPDATE NOWAIT;
-- If another transaction holds locks on these rows,
-- this IMMEDIATELY raises an error instead of waiting
```

**Concrete scenario — Merchant has ₹1,000. Two simultaneous ₹600 requests:**

| Time | Request A (₹600) | Request B (₹600) |
|------|------------------|------------------|
| T1 | `BEGIN TRANSACTION` | `BEGIN TRANSACTION` |
| T2 | `SELECT FOR UPDATE NOWAIT` → acquires row locks | |
| T3 | Reads balance = ₹1,000. Checks: 1000 ≥ 600 ✓ | `SELECT FOR UPDATE NOWAIT` → `OperationalError` (rows locked by A) |
| T4 | Creates payout, creates debit entry (-₹600) | Catches error → returns 409 Conflict |
| T5 | `COMMIT`. Balance is now ₹400. | Client retries later if needed |

**Why `NOWAIT` instead of blocking?**

- In fintech, fail-fast beats waiting. The user gets an immediate, honest "try again" instead of hanging for unknown seconds.
- Prevents request timeout cascades under high load
- Prevents deadlocks from accumulating

**Why lock `LedgerEntry` rows and not the `Merchant` row?**

The balance is calculated FROM ledger entries. If I lock the Merchant row but not the entries, another transaction could insert a new LedgerEntry between my balance read and my debit write. Locking what you're reading is the correct pattern.

---

## 3. The Idempotency

### How does the system know it has seen a key before?

The `IdempotencyKey` model has `unique_together = ('merchant', 'key')` enforced at the database level:

```python
# apps/payouts/models.py
class IdempotencyKey(models.Model):
    merchant = models.ForeignKey('merchants.Merchant', ...)
    key = models.UUIDField()
    response_body = models.JSONField(null=True)
    response_status_code = models.IntegerField(null=True)
    status = models.CharField(choices=[('processing', ...), ('completed', ...)])
    expires_at = models.DateTimeField()

    class Meta:
        unique_together = ('merchant', 'key')
```

**The lookup flow in the view:**

```python
# apps/payouts/views.py — STEP 4

try:
    existing_key = IdempotencyKey.objects.get(
        merchant=merchant, key=idempotency_uuid
    )
    
    if existing_key.is_expired:
        existing_key.delete()
        raise IdempotencyKey.DoesNotExist()  # Treat as new
    
    if existing_key.status == 'processing':
        return Response(status=409)  # "First request still in-flight"
    
    if existing_key.status == 'completed':
        return Response(existing_key.response_body, status=201)  # Cached response
        
except IdempotencyKey.DoesNotExist:
    pass  # New key — proceed to create payout
```

### What happens if the first request is in-flight when the second arrives?

| Time | Request 1 (original) | Request 2 (retry) |
|------|----------------------|-------------------|
| T1 | Creates `IdempotencyKey` with `status='processing'` | |
| T2 | Enters `transaction.atomic()`, checking balance... | Finds key with `status='processing'` |
| T3 | Still processing... | Returns 409 Conflict — "first request is still running" |
| T4 | Finishes. Updates key: `status='completed'`, stores `response_body` | |
| T5 | Returns 201 to client | Client retries → gets cached 201 response |

**What prevents two requests from BOTH creating the key?**

The `unique_together` constraint at the DB level. If two requests try to `INSERT` the same `(merchant, key)` simultaneously, one gets an `IntegrityError`.

**Why 24-hour expiry?**

Keys can't be stored forever — the table would grow indefinitely. 24 hours covers any realistic retry scenario (client timeout, network failure, user refreshing).

---

## 4. The State Machine

### Where is `failed → completed` blocked?

```python
# apps/payouts/models.py — Payout class

ALLOWED_TRANSITIONS = {
    'pending': ['processing'],
    'processing': ['completed', 'failed'],
    'completed': [],     # ← EMPTY: terminal state, nothing allowed
    'failed': [],        # ← EMPTY: terminal state, nothing allowed
}

def transition_to(self, new_status):
    # CHECK 1: Is this transition legal?
    allowed = self.ALLOWED_TRANSITIONS.get(self.status, [])
    if new_status not in allowed:
        raise InvalidTransitionError(
            f"Cannot transition from '{self.status}' to '{new_status}'. "
            f"Allowed transitions from '{self.status}': {allowed}"
        )
    
    # CHECK 2: Optimistic lock at DB level
    updated_count = Payout.objects.filter(
        id=self.id,
        status=self.status  # WHERE status = what we EXPECT it to be
    ).update(status=new_status, updated_at=timezone.now())
    
    if updated_count == 0:
        raise ConcurrentModificationError(
            f"Payout #{self.id} was modified by another process."
        )
```

**Walkthrough of `failed → completed` being blocked:**

1. A payout is in `failed` status
2. Some code calls `payout.transition_to('completed')`
3. `self.status` is `'failed'`
4. `allowed = ALLOWED_TRANSITIONS['failed']` → `[]` (empty list)
5. `'completed' not in []` → `True`
6. `InvalidTransitionError` is raised — **transition blocked**

**Why two layers of protection?**

- **Layer 1 (Python):** The `ALLOWED_TRANSITIONS` dict catches logic errors immediately. Readable, fast, explicit.
- **Layer 2 (Database):** The `filter(id=X, status=current_status).update()` pattern is an optimistic lock. If two Celery workers try to transition the same payout simultaneously, only one's `UPDATE` will match the `WHERE` clause. The other gets `updated_count = 0` → `ConcurrentModificationError`.

**Atomic fund return on failure:**

```python
# apps/payouts/tasks.py — inside process_payout()

with transaction.atomic():
    payout.transition_to('failed')
    
    # Return funds in the SAME transaction
    LedgerEntry.objects.create(
        merchant=payout.merchant,
        entry_type='credit',
        amount_paise=payout.amount_paise,  # POSITIVE = money returned
        description=f'Payout #{payout.id} failed - Funds returned',
        payout=payout,
    )
```

If the state transition succeeds but the ledger entry creation fails, the entire transaction rolls back — atomicity guarantees both happen or neither happens.

---

## 5. The AI Audit

### What AI gave me (subtly wrong)

When I asked AI to implement the concurrency-safe payout creation, it suggested locking the **Merchant row** instead of the **LedgerEntry rows**:

```python
# ❌ What AI generated — WRONG

with transaction.atomic():
    # Lock the merchant row
    merchant = Merchant.objects.select_for_update().get(id=merchant_id)
    
    # Then calculate balance from ledger (NOT locked)
    balance = LedgerEntry.objects.filter(
        merchant=merchant
    ).aggregate(total=Sum('amount_paise'))['total'] or 0
    
    if balance < amount_paise:
        raise InsufficientFundsError()
    
    # Create payout and debit...
```

### What I caught

Three problems:

1. **Wrong rows locked.** The balance comes from `LedgerEntry` rows, but we locked the `Merchant` row. Between reading the balance (from unlocked `LedgerEntry` rows) and creating the debit entry, another transaction could `INSERT` a debit `LedgerEntry`. The balance check would pass for both transactions, causing an overdraw.

2. **No NOWAIT.** Without `nowait=True`, if the Merchant row is locked by another transaction, this request silently blocks. Under high concurrency, requests pile up, causing timeouts. In a payment system, a 30-second hanging request is worse than an immediate rejection.

3. **Locking something we don't modify.** We never `UPDATE` the Merchant table during a payout. Locking a row you're only reading is semantically wrong and causes unnecessary write contention on unrelated operations (like updating merchant profile).

### What I replaced it with

```python
# ✅ What I implemented — CORRECT

with transaction.atomic():
    # Lock the LEDGER ENTRIES (what we're actually reading)
    balance = (
        LedgerEntry.objects
        .select_for_update(nowait=True)  # NOWAIT = fail fast
        .filter(merchant=merchant)
        .aggregate(total=Sum('amount_paise'))['total'] or 0
    )
    
    if balance < amount_paise:
        raise InsufficientFundsError()
    
    # Create payout and debit entry INSIDE the same atomic block
    payout = Payout.objects.create(...)
    LedgerEntry.objects.create(amount_paise=-amount_paise, ...)
```

**Why this is correct:**
- Locks the rows we're actually calculating the balance from
- `NOWAIT` fails immediately if rows are locked (fail-fast for fintech)
- The aggregate runs on the locked rows — no other transaction can modify them until we commit
- The debit entry is created inside the same transaction, maintaining atomicity

This is the standard pessimistic locking with NOWAIT pattern used in PostgreSQL for financial balance checks. I verified this against Stripe's API design documentation and PostgreSQL's advisory on financial applications.

---

## Deployment Notes

### Production Architecture (Render Free Tier)

| Component | Implementation | Production Alternative |
|-----------|---------------|------------------------|
| Django API | Render Web Service | AWS ECS / GCP Cloud Run |
| Celery Worker | `CELERY_TASK_ALWAYS_EAGER=True` (sync) | Dedicated worker processes |
| Celery Beat | Disabled | Dedicated beat scheduler |
| PostgreSQL | Render Managed PostgreSQL | AWS RDS / GCP Cloud SQL |
| Redis | Not needed (eager mode) | ElastiCache / Memorystore |
| Frontend | Vercel (static) | Vercel / CloudFront |

**Why eager mode?** Render's free tier doesn't support background workers. Setting `CELERY_TASK_ALWAYS_EAGER=True` runs Celery tasks synchronously during the API call. In production, dedicated Celery workers would process payouts asynchronously.

**Cold starts:** Free tier services sleep after 15 minutes of inactivity. First request takes ~30-60 seconds. The frontend shows a "Backend waking up" banner during this time.

### What I'd add with more time

- **JWT authentication** — per-merchant login instead of merchant selector dropdown
- **Webhook delivery** — POST to merchant's URL when payout status changes, with retry queue
- **Rate limiting** — prevent API abuse (`django-ratelimit` or DRF throttling)
- **Database read replicas** — separate balance reads from payout writes under high load
- **Observability** — Sentry for errors, structured logging, Prometheus metrics for payout latency
- **Idempotency key cleanup** — periodic task to delete expired keys (>24 hours)