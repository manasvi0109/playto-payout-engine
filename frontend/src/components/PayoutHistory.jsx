import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  ClockIcon,
  SignalIcon,
} from '@heroicons/react/24/solid';
import { fetchPayouts } from '../api/client';
import { formatRupees, formatDate, formatRelativeTime } from '../utils/format';
import StatusBadge from './StatusBadge';

export default function PayoutHistory({ merchantId, refreshTrigger }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadPayouts = async () => {
    if (!merchantId) return;
    try {
      const data = await fetchPayouts(merchantId);
      setPayouts(data.results || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPayouts();
  }, [merchantId, refreshTrigger]);

  useEffect(() => {
    const hasActivePayouts = payouts.some(
      (p) => p.status === 'pending' || p.status === 'processing'
    );

    if (hasActivePayouts) {
      intervalRef.current = setInterval(loadPayouts, 5000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [payouts, merchantId]);

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <ClockIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Payout History</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-700/30 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const hasActivePayouts = payouts.some(
    (p) => p.status === 'pending' || p.status === 'processing'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden mb-8"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-xl">
              <ArrowPathIcon className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Payout History
              </h3>
              <p className="text-xs text-gray-500">
                {payouts.length} payout{payouts.length !== 1 ? 's' : ''}
                {lastUpdated && (
                  <span> · Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
                )}
              </p>
            </div>
          </div>

          {hasActivePayouts && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
              <SignalIcon className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400 font-medium">
                Live — polling every 5s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payout Cards (Mobile-friendly) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/30">
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Payout
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Amount
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Destination
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Status
              </th>
              <th className="text-center text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Attempts
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            <AnimatePresence>
              {payouts.map((payout, index) => (
                <motion.tr
                  key={payout.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-700/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-gray-300 bg-gray-700/50 px-2 py-0.5 rounded">
                      #{payout.id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-white">
                      {formatRupees(payout.amount_paise)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-300">
                        {payout.bank_account_details?.nickname || 'Bank Account'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {payout.bank_account_details?.account_number} •{' '}
                        {payout.bank_account_details?.ifsc_code}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={payout.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-gray-400 font-mono">
                      {payout.attempt_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-xs text-gray-400">
                        {formatDate(payout.created_at)}
                      </p>
                      {payout.processed_at && (
                        <p className="text-xs text-gray-600">
                          Done: {formatRelativeTime(payout.processed_at)}
                        </p>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-700/30">
        {payouts.map((payout) => (
          <div key={payout.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
                #{payout.id}
              </span>
              <StatusBadge status={payout.status} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-white">
                {formatRupees(payout.amount_paise)}
              </span>
              <span className="text-xs text-gray-500">
                {formatRelativeTime(payout.created_at)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {payout.bank_account_details?.nickname} •{' '}
              {payout.bank_account_details?.ifsc_code}
            </p>
          </div>
        ))}
      </div>

      {payouts.length === 0 && (
        <div className="p-12 text-center">
          <ArrowPathIcon className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No payouts yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Submit a payout request above to get started
          </p>
        </div>
      )}
    </motion.div>
  );
}