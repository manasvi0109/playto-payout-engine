import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';
import { fetchLedger } from '../api/client';
import { formatRupees, formatDate, formatRelativeTime } from '../utils/format';

export default function LedgerTable({ merchantId, refreshTrigger }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    if (!merchantId) return;

    const loadLedger = async () => {
      try {
        setLoading(true);
        const data = await fetchLedger(merchantId, page);
        setEntries(data.results || []);
        setTotalCount(data.count || 0);
        setHasNext(!!data.next);
        setHasPrevious(!!data.previous);
      } catch (err) {
        console.error('Ledger fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLedger();
  }, [merchantId, page, refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <DocumentTextIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Transaction Ledger</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-gray-700/50 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-xl">
              <DocumentTextIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Transaction Ledger
              </h3>
              <p className="text-xs text-gray-500">{totalCount} total entries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/30">
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Date
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Description
              </th>
              <th className="text-left text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Type
              </th>
              <th className="text-right text-xs text-gray-500 font-medium px-6 py-3 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            <AnimatePresence>
              {entries.map((entry, index) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="hover:bg-gray-700/20 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-300">
                        {formatDate(entry.created_at)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatRelativeTime(entry.created_at)}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-300">{entry.description}</p>
                    {entry.payout_id && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Payout #{entry.payout_id}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {entry.entry_type === 'credit' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ArrowUpIcon className="h-3 w-3" />
                        Credit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <ArrowDownIcon className="h-3 w-3" />
                        Debit
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`text-sm font-mono font-semibold ${
                        entry.amount_paise >= 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {entry.amount_paise >= 0 ? '+' : ''}
                      {formatRupees(entry.amount_paise)}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>

            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <DocumentTextIcon className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No ledger entries found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(hasNext || hasPrevious) && (
        <div className="px-6 py-4 border-t border-gray-700/50 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasPrevious}
            className={`inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              hasPrevious
                ? 'bg-gray-700/50 text-white hover:bg-gray-600/50 active:scale-95'
                : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
            }`}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.ceil(totalCount / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className={`inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              hasNext
                ? 'bg-gray-700/50 text-white hover:bg-gray-600/50 active:scale-95'
                : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
            }`}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}