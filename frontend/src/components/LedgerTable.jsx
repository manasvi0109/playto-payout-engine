/**
 * LedgerTable — Shows merchant's transaction history.
 * 
 * Displays a paginated table of all credits and debits.
 * Like a bank statement view.
 */

import { useState, useEffect } from 'react';
import { fetchLedger } from '../api/client';

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

  const formatRupees = (paise) => {
    const rupees = paise / 100;
    const sign = paise >= 0 ? '+' : '';
    return `${sign}₹${Math.abs(rupees).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Ledger</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6 overflow-hidden">
      <div className="p-5 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">
          Ledger <span className="text-sm text-gray-400 font-normal">({totalCount} entries)</span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/50">
              <th className="text-left text-xs text-gray-400 font-medium p-3">Date</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Description</th>
              <th className="text-left text-xs text-gray-400 font-medium p-3">Type</th>
              <th className="text-right text-xs text-gray-400 font-medium p-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td className="p-3 text-sm text-gray-300">
                  {formatDate(entry.created_at)}
                                </td>
                <td className="p-3 text-sm text-gray-300">
                  {entry.description}
                  {entry.payout_id && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Payout #{entry.payout_id})
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      entry.entry_type === 'credit'
                        ? 'bg-green-900/50 text-green-400 border border-green-800'
                        : 'bg-red-900/50 text-red-400 border border-red-800'
                    }`}
                  >
                    {entry.entry_type === 'credit' ? '↑ Credit' : '↓ Debit'}
                  </span>
                </td>
                <td
                  className={`p-3 text-sm text-right font-mono font-medium ${
                    entry.amount_paise >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatRupees(entry.amount_paise)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No ledger entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(hasNext || hasPrevious) && (
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasPrevious}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasPrevious
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hasNext
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}