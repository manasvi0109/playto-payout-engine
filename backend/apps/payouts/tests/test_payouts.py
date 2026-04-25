"""
Tests for the payout engine.

Two critical tests:
1. Concurrency: Two simultaneous payouts for more than available balance
   → exactly one succeeds
2. Idempotency: Same key sent twice → same response, one payout in DB

These tests prove the system handles real-world edge cases that would
cause financial loss if not handled properly.
"""

import uuid
import threading
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.test import TestCase, TransactionTestCase
from django.test.client import Client
from django.db import connection

from apps.merchants.models import Merchant, BankAccount
from apps.ledger.models import LedgerEntry
from apps.payouts.models import Payout, IdempotencyKey


class PayoutConcurrencyTest(TransactionTestCase):
    """
    Test that concurrent payout requests don't overdraw a merchant's balance.
    
    WHY TransactionTestCase instead of TestCase?
    - TestCase wraps each test in a transaction — SELECT FOR UPDATE won't
      work properly because all threads share the same transaction
    - TransactionTestCase uses real transactions — each thread gets its own
    - This is slower but necessary for testing DB-level locking
    """
    
    def setUp(self):
        """Create test merchant with exactly ₹1,000 balance."""
        self.merchant = Merchant.objects.create(
            name='Test Merchant',
            email='test@example.com',
        )
        self.bank_account = BankAccount.objects.create(
            merchant=self.merchant,
            account_number='1234567890',
            ifsc_code='SBIN0001234',
            nickname='Test Account',
        )
        # Give merchant exactly ₹1,000 (100000 paise)
        LedgerEntry.objects.create(
            merchant=self.merchant,
            entry_type='credit',
            amount_paise=100000,  # ₹1,000.00
            description='Test credit',
        )
    
    def test_concurrent_payouts_no_overdraw(self):
        """
        Scenario: Merchant has ₹1,000. Two simultaneous requests for ₹600 each.
        Expected: Exactly ONE succeeds, the other is rejected.
        Total debits should NEVER exceed ₹1,000.
        
        How this works:
        1. We spin up 2 threads, each making a ₹600 payout request
        2. Thread A gets the lock first (SELECT FOR UPDATE NOWAIT)
        3. Thread A sees balance = ₹1,000 ≥ ₹600, creates payout
        4. Thread B tries to get the lock — BLOCKED by NOWAIT
        5. Thread B gets OperationalError → returns 409 Conflict
        6. Thread A's transaction commits
        7. Result: 1 payout created, balance = ₹400
        """
        results = []
        errors = []
        
        def make_payout_request():
            """Each thread makes its own HTTP request."""
            try:
                client = Client()
                response = client.post(
                    '/api/v1/payouts/',
                    data={
                        'merchant_id': self.merchant.id,
                        'amount_paise': 60000,  # ₹600.00
                        'bank_account_id': self.bank_account.id,
                    },
                    content_type='application/json',
                    HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
                )
                results.append({
                    'status_code': response.status_code,
                    'body': response.json(),
                })
            except Exception as e:
                errors.append(str(e))
            finally:
                # Close DB connection for this thread
                # (each thread needs its own connection)
                connection.close()
        
        # Run 2 concurrent requests
        threads = []
        for _ in range(2):
            t = threading.Thread(target=make_payout_request)
            threads.append(t)
        
        # Start all threads as close together as possible
        for t in threads:
            t.start()
        
        # Wait for all threads to finish
        for t in threads:
            t.join(timeout=10)
        
        # Assert no unexpected errors
        self.assertEqual(len(errors), 0, f"Unexpected errors: {errors}")
        
        # Assert we got exactly 2 responses
        self.assertEqual(len(results), 2, f"Expected 2 results, got {len(results)}")
        
        # Count successes (201) and rejections (400 or 409)
        successes = [r for r in results if r['status_code'] == 201]
        rejections = [r for r in results if r['status_code'] in (400, 409)]
        
        # CRITICAL ASSERTION: Exactly one succeeds
        self.assertEqual(
            len(successes), 1,
            f"Expected exactly 1 success, got {len(successes)}. "
            f"Results: {results}"
        )
        
        # The other should be rejected
        self.assertEqual(
            len(rejections), 1,
            f"Expected exactly 1 rejection, got {len(rejections)}. "
            f"Results: {results}"
        )
        
        # Verify only 1 payout was created in DB
        payout_count = Payout.objects.filter(merchant=self.merchant).count()
        self.assertEqual(
            payout_count, 1,
            f"Expected 1 payout in DB, found {payout_count}"
        )
        
        # Verify balance is correct (₹1,000 - ₹600 = ₹400)
        balance = LedgerEntry.get_balance(self.merchant.id)
        self.assertEqual(
            balance, 40000,  # ₹400.00 in paise
            f"Expected balance of 40000 paise, got {balance}"
        )
        
        print("\n✅ Concurrency test passed!")
        print(f"   Successes: {len(successes)}")
        print(f"   Rejections: {len(rejections)}")
        print(f"   Final balance: ₹{balance / 100:.2f}")


class PayoutIdempotencyTest(TransactionTestCase):
    """
    Test that the same idempotency key returns the same response
    without creating a duplicate payout.
    """
    
    def setUp(self):
        """Create test merchant with ₹5,000 balance."""
        self.merchant = Merchant.objects.create(
            name='Idempotency Test Merchant',
            email='idem@example.com',
        )
        self.bank_account = BankAccount.objects.create(
            merchant=self.merchant,
            account_number='9999888877',
            ifsc_code='HDFC0009999',
            nickname='Test Account',
        )
        LedgerEntry.objects.create(
            merchant=self.merchant,
            entry_type='credit',
            amount_paise=500000,  # ₹5,000.00
            description='Test credit',
        )
    
    def test_same_idempotency_key_returns_same_response(self):
        """
        Scenario: Client sends same request twice with same Idempotency-Key.
        Expected: Both return 201 with identical response. Only 1 payout in DB.
        
        This simulates a real-world scenario where:
        - Client sends payout request
        - Network timeout — client doesn't receive response
        - Client retries with SAME idempotency key
        - Server recognizes the duplicate and returns cached response
        """
        client = Client()
        idempotency_key = str(uuid.uuid4())
        
        request_data = {
            'merchant_id': self.merchant.id,
            'amount_paise': 100000,  # ₹1,000.00
            'bank_account_id': self.bank_account.id,
        }
        
        # First request
        response1 = client.post(
            '/api/v1/payouts/',
            data=request_data,
            content_type='application/json',
            HTTP_IDEMPOTENCY_KEY=idempotency_key,
        )
        
        # Second request with SAME key
        response2 = client.post(
            '/api/v1/payouts/',
            data=request_data,
            content_type='application/json',
            HTTP_IDEMPOTENCY_KEY=idempotency_key,
        )
        
        # Both should return 201
        self.assertEqual(response1.status_code, 201, f"First request failed: {response1.json()}")
        self.assertEqual(response2.status_code, 201, f"Second request failed: {response2.json()}")
        
        # Both should return IDENTICAL responses
        data1 = response1.json()
        data2 = response2.json()
        self.assertEqual(
            data1['id'], data2['id'],
            f"Different payout IDs! First: {data1['id']}, Second: {data2['id']}"
        )
        self.assertEqual(
            data1['amount_paise'], data2['amount_paise'],
            "Amounts don't match!"
        )
        
        # Only 1 payout should exist in DB
        payout_count = Payout.objects.filter(merchant=self.merchant).count()
        self.assertEqual(
            payout_count, 1,
            f"Expected 1 payout in DB, found {payout_count}"
        )
        
        # Only 1 debit ledger entry (not 2!)
        debit_count = LedgerEntry.objects.filter(
            merchant=self.merchant,
            entry_type='debit',
        ).count()
        self.assertEqual(
            debit_count, 1,
            f"Expected 1 debit entry, found {debit_count}"
        )
        
        # Balance should reflect only 1 deduction
        balance = LedgerEntry.get_balance(self.merchant.id)
        self.assertEqual(
            balance, 400000,  # ₹5,000 - ₹1,000 = ₹4,000
            f"Expected 400000 paise, got {balance}"
        )
        
        print("\n✅ Idempotency test passed!")
        print(f"   Payout ID (both requests): {data1['id']}")
        print(f"   Payouts in DB: {payout_count}")
        print(f"   Debit entries: {debit_count}")
        print(f"   Final balance: ₹{balance / 100:.2f}")


class PayoutStateMachineTest(TestCase):
    """
    Test that the state machine blocks invalid transitions.
    
    This proves that a failed payout can NEVER become completed,
    and a completed payout can NEVER go back to pending.
    """
    
    def setUp(self):
        self.merchant = Merchant.objects.create(
            name='State Machine Test Merchant',
            email='state@example.com',
        )
        self.bank_account = BankAccount.objects.create(
            merchant=self.merchant,
            account_number='1111222233',
            ifsc_code='ICIC0001111',
            nickname='Test Account',
        )
    
    def _create_payout(self, status='pending'):
        """Helper to create a payout in a specific status."""
        payout = Payout.objects.create(
            merchant=self.merchant,
            bank_account=self.bank_account,
            amount_paise=10000,
            status=status,
        )
        return payout
    
    def test_valid_transition_pending_to_processing(self):
        """pending → processing should work."""
        payout = self._create_payout('pending')
        result = payout.transition_to('processing')
        self.assertTrue(result)
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'processing')
        print("✅ pending → processing: ALLOWED (correct)")
    
    def test_valid_transition_processing_to_completed(self):
        """processing → completed should work."""
        payout = self._create_payout('processing')
        result = payout.transition_to('completed')
        self.assertTrue(result)
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'completed')
        self.assertIsNotNone(payout.processed_at)
        print("✅ processing → completed: ALLOWED (correct)")
    
    def test_valid_transition_processing_to_failed(self):
        """processing → failed should work."""
        payout = self._create_payout('processing')
        result = payout.transition_to('failed')
        self.assertTrue(result)
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'failed')
        self.assertIsNotNone(payout.processed_at)
        print("✅ processing → failed: ALLOWED (correct)")
    
    def test_invalid_transition_failed_to_completed(self):
        """failed → completed must be BLOCKED."""
        from apps.payouts.models import InvalidTransitionError
        
        payout = self._create_payout('failed')
        with self.assertRaises(InvalidTransitionError) as context:
            payout.transition_to('completed')
        
        self.assertIn('failed', str(context.exception))
        self.assertIn('completed', str(context.exception))
        
        # Verify status didn't change in DB
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'failed')
        print("✅ failed → completed: BLOCKED (correct)")
    
    def test_invalid_transition_completed_to_pending(self):
        """completed → pending must be BLOCKED."""
        from apps.payouts.models import InvalidTransitionError
        
        payout = self._create_payout('completed')
        with self.assertRaises(InvalidTransitionError):
            payout.transition_to('pending')
        
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'completed')
        print("✅ completed → pending: BLOCKED (correct)")
    
    def test_invalid_transition_completed_to_failed(self):
        """completed → failed must be BLOCKED."""
        from apps.payouts.models import InvalidTransitionError
        
        payout = self._create_payout('completed')
        with self.assertRaises(InvalidTransitionError):
            payout.transition_to('failed')
        
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'completed')
        print("✅ completed → failed: BLOCKED (correct)")
    
    def test_invalid_transition_pending_to_completed(self):
        """pending → completed must be BLOCKED (must go through processing)."""
        from apps.payouts.models import InvalidTransitionError
        
        payout = self._create_payout('pending')
        with self.assertRaises(InvalidTransitionError):
            payout.transition_to('completed')
        
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'pending')
        print("✅ pending → completed: BLOCKED (correct — must go through processing)")
    
    def test_invalid_transition_pending_to_failed(self):
        """pending → failed must be BLOCKED (must go through processing)."""
        from apps.payouts.models import InvalidTransitionError
        
        payout = self._create_payout('pending')
        with self.assertRaises(InvalidTransitionError):
            payout.transition_to('failed')
        
        payout.refresh_from_db()
        self.assertEqual(payout.status, 'pending')
        print("✅ pending → failed: BLOCKED (correct)")