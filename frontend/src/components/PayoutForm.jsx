/**
 * PayoutForm — Form to submit a new payout request.
 *
 * Features:
 * - Auto-generates UUID idempotency key for each submission
 * - Validates amount (minimum ₹1, must be positive)
 * - Shows loading state during submission
 * - Shows success/error feedback
 * - Resets form after successful submission
 */

import { useState, useEffect } from 'react';
import { createPayout, fetchBankAccounts } from '../api/client';

// Generate a UUID v4 (browser-native)
function generateUUID() {
  return crypto.randomUUID();
}

export default function PayoutForm({ merchantId, onPayoutCreated }) {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(generateUUID());

  // Load bank accounts when merchant changes
  useEffect(() => {
    if (!merchantId) return;

    const loadAccounts = async () => {
      try {
        const data = await fetchBankAccounts(merchantId);
        setBankAccounts(data);
        // Auto-select first account
        if (data.length > 0) {
          setSelectedAccountId(data[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load bank accounts:', err);
      }
    };

    loadAccounts();
  }, [merchantId]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate amount
    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees < 1) {
      setError('Please enter a valid amount (minimum ₹1.00)');
      return;
    }

    if (!selectedAccountId) {
      setError('Please select a bank account');
      return;
    }

    // Convert rupees to paise (integer)
    const amountPaise = Math.round(rupees * 100);

    setLoading(true);

    try {
      const response = await createPayout(
        {
          merchant_id: merchantId,
          amount_paise: amountPaise,
          bank_account_id: parseInt(selectedAccountId),
        },
        idempotencyKey
      );

      setSuccess(
        `Payout #${response.id} created for ₹${rupees.toFixed(2)}! Status: ${response.status}`
      );

      // Reset form
      setAmountRupees('');
      // Generate new idempotency key for next request
      setIdempotencyKey(generateUUID());

      // Notify parent to refresh data
      if (onPayoutCreated) {
        onPayoutCreated(response);
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.error) {
        setError(errorData.error);
        if (errorData.available_balance_paise !== undefined) {
          setError(
            `${errorData.error} Available: ₹${(
              errorData.available_balance_paise / 100
            ).toFixed(2)}`
          );
        }
      } else if (err.response?.status === 409) {
        setError('Another payout is being processed. Please wait and try again.');
      } else {
        setError('Failed to create payout. Please try again.');
      }

      // Generate new idempotency key on error so they can retry
      setIdempotencyKey(generateUUID());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6 overflow-hidden">
      <div className="p-5 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Request Payout</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-5">
        {/* Success message */}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
            <p className="text-green-400 text-sm">✅ {success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">❌ {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Amount input */}
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                ₹
              </span>
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="500.00"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-8 py-2.5 
                           text-white placeholder-gray-500 focus:outline-none focus:ring-2 
                           focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Bank account selector */}
          <div>
            <label
              htmlFor="bank-account"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Bank Account
            </label>
            <select
              id="bank-account"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 
                         text-white focus:outline-none focus:ring-2 focus:ring-blue-500 
                         focus:border-transparent"
              required
              disabled={loading}
            >
              <option value="">Select account</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname || `Account ****${account.account_number.slice(-4)}`}
                  {' '}({account.ifsc_code})
                </option>
              ))}
            </select>
          </div>

          {/* Submit button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className={`w-full px-6 py-2.5 rounded-lg font-medium text-sm transition-all
                         ${
                           loading
                             ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                             : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                         }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Submit Payout'
              )}
            </button>
          </div>
        </div>

        {/* Idempotency key display (for transparency) */}
        <div className="mt-3">
          <p className="text-xs text-gray-600">
            Idempotency Key: <code className="text-gray-500">{idempotencyKey}</code>
          </p>
        </div>
      </form>
    </div>
  );
}