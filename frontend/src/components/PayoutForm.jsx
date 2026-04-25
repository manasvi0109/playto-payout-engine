import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { createPayout, fetchBankAccounts } from '../api/client';

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

  useEffect(() => {
    if (!merchantId) return;
    const loadAccounts = async () => {
      try {
        const data = await fetchBankAccounts(merchantId);
        setBankAccounts(data);
        if (data.length > 0) setSelectedAccountId(data[0].id.toString());
      } catch (err) {
        console.error('Failed to load bank accounts:', err);
      }
    };
    loadAccounts();
  }, [merchantId]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees < 1) {
      setError('Please enter a valid amount (minimum ₹1.00)');
      return;
    }
    if (!selectedAccountId) {
      setError('Please select a bank account');
      return;
    }

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

      const statusMsg = response.status === 'completed' 
        ? 'processed and completed' 
        : response.status === 'failed'
        ? 'processed but failed — funds returned'
        : 'created and queued for processing';
      
      setSuccess({
        message: `Payout #${response.id} ${statusMsg}!`,
        amount: `₹${rupees.toFixed(2)}`,
        status: response.status,
      });
      setAmountRupees('');
      setIdempotencyKey(generateUUID());
      if (onPayoutCreated) onPayoutCreated(response);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.error) {
        let message = errorData.error;
        if (errorData.available_balance_paise !== undefined) {
          message += ` (Available: ₹${(errorData.available_balance_paise / 100).toFixed(2)})`;
        }
        setError(message);
      } else if (err.response?.status === 409) {
        setError('Another payout is being processed. Please wait and try again.');
      } else {
        setError('Failed to create payout. Please try again.');
      }
      setIdempotencyKey(generateUUID());
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden mb-8"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-xl">
            <PaperAirplaneIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Request Payout</h3>
            <p className="text-xs text-gray-500">
              Transfer funds to your bank account
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {/* Notifications */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-emerald-300 text-sm font-medium">
                    {success.message}
                  </p>
                  <p className="text-emerald-400/60 text-xs">
                    Amount: {success.amount} — Processing will begin shortly
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Amount */}
          <div className="md:col-span-4">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-400 mb-2">
              <BanknotesIcon className="h-4 w-4" />
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="500.00"
                className="w-full bg-gray-900/50 border border-gray-600/50 rounded-xl pl-8 pr-4 py-3 
                           text-white placeholder-gray-600 
                           focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                           transition-all duration-200"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Bank Account */}
          <div className="md:col-span-5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-400 mb-2">
              <BuildingLibraryIcon className="h-4 w-4" />
              Bank Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-600/50 rounded-xl px-4 py-3 
                         text-white appearance-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                         transition-all duration-200"
              required
              disabled={loading}
            >
              <option value="">Select account</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname ||
                    `Account ****${account.account_number.slice(-4)}`}{' '}
                  • {account.ifsc_code}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl 
                         font-semibold text-sm transition-all duration-200 ${
                           loading
                             ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                             : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] shadow-lg shadow-blue-500/20'
                         }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Submit Payout
                </>
              )}
            </button>
          </div>
        </div>

        {/* Idempotency Key (subtle) */}
        <div className="mt-4 flex items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
          <KeyIcon className="h-3 w-3 text-gray-500" />
          <p className="text-[10px] text-gray-500 font-mono truncate">
            Idempotency: {idempotencyKey}
          </p>
        </div>
      </form>
    </motion.div>
  );
}