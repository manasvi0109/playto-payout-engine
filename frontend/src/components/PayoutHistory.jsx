/**
 * PayoutHistory — Shows payout requests with live status polling.
 *
 * Features:
 * - Polls every 5 seconds for status updates
 * - Color-coded status badges
 * - Shows attempt count for retried payouts
 * - Auto-refreshes when new payout is created
 */

import { useState, useEffect, useRef } from 'react';
import { fetchPayouts } from '../api/client';

// Status badge configurations
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bgClass: 'bg-yellow-900/50',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-800',
    icon: '⏳',
  },
  processing: {
    label: 'Processing',
    bgClass: 'bg-blue-900/50',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-800',
    icon: '⚙️',
  },
  completed: {
    label: 'Completed',
    bgClass: 'bg-green-900/50',
    textClass: 'text-green-400',
    borderClass: 'border-green-800',
    icon: '✅',
  },
  failed: {
    label: 'Failed',
    bgClass: 'bg-red-900/50',
    textClass: 'text-red-400',
    borderClass: 'border-red-800',
    icon: '❌',
  },
};

export default function PayoutHistory({ merchantId, refreshTrigger }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const loadPayouts = async () => {
    if (!merchantId) return;
    try {
      const data = await fetchPayouts(merchantId);
      setPayouts(data.results || []);
    } catch (err) {
      console.error('Failed to fetch payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load + refresh on trigger
  useEffect(() => {
    setLoading(true);
    loadPayouts();
  }, [merchantId, refreshTrigger]);

  // Poll every 5 seconds for status updates
  useEffect(() => {
    // Only poll if there are non-terminal payouts
    const hasActivePayouts = payouts.some(
      (p) => p.status === 'pending' || p.status === 'processing'
    );

    if (hasActivePayouts) {
      intervalRef.current = setInterval(loadPayouts, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [payouts, merchantId]);

  const formatRupees = (paise) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Payout History</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="p-5 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Payout History{' '}
          <span className="text-sm text-gray-400 font-normal">
            ({payouts.length} payouts)
          </span>
        </h3>
        {payouts.some(
          (p) => p.status === 'pending' || p.status === 'processing'
        ) && (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Live updating
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/50">
              <th className="text-left text-xs text-gray-400 font-medium p-3">ID</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Amount</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Bank Account</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Status</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Attempts</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Created</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Processed</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => {
              const statusConf = STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
              return (
                <tr
                  key={payout.id}
                  className="border-t border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="p-3 text-sm text-gray-300 font-mono">
                    #{payout.id}
                  </td>
                  <td className="p-3 text-sm text-white font-medium">
                    {formatRupees(payout.amount_paise)}
                  </td>
                  <td className="p-3 text-sm text-gray-300">
                    {payout.bank_account_details?.nickname ||
                      `****${payout.bank_account_details?.account_number || ''}`}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConf.bgClass} ${statusConf.textClass} ${statusConf.borderClass}`}
                    >
                      <span>{statusConf.icon}</span>
                      {statusConf.label}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-400 text-center">
                    {payout.attempt_count}
                  </td>
                  <td className="p-3 text-xs text-gray-400">
                    {formatDate(payout.created_at)}
                  </td>
                  <td className="p-3 text-xs text-gray-400">
                    {formatDate(payout.processed_at)}
                  </td>
                </tr>
              );
            })}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No payouts yet. Submit one above!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}