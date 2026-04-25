/**
 * BalanceCard — Shows merchant's financial summary.
 * 
 * Displays:
 * - Available balance (what can be withdrawn)
 * - Held balance (locked for pending payouts)
 * - Total credits and debits
 */

import { useState, useEffect } from 'react';
import { fetchBalance } from '../api/client';

export default function BalanceCard({ merchantId, refreshTrigger }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!merchantId) return;
    
    const loadBalance = async () => {
      try {
        setLoading(true);
        const data = await fetchBalance(merchantId);
        setBalance(data);
        setError(null);
      } catch (err) {
        setError('Failed to load balance');
        console.error('Balance fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();
  }, [merchantId, refreshTrigger]);

  // Format paise to rupees string
  const formatRupees = (paise) => {
    if (paise === null || paise === undefined) return '₹0.00';
    return `₹${(paise / 100).toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-24 mb-3"></div>
            <div className="h-8 bg-gray-700 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-5 mb-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Available Balance */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p className="text-sm text-gray-400 mb-1">Available Balance</p>
        <p className="text-2xl font-bold text-green-400">
          {formatRupees(balance?.available_balance_paise)}
        </p>
      </div>

      {/* Held Balance */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p className="text-sm text-gray-400 mb-1">Held (In Transit)</p>
        <p className="text-2xl font-bold text-yellow-400">
          {formatRupees(balance?.held_balance_paise)}
        </p>
      </div>

      {/* Total Credits */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p className="text-sm text-gray-400 mb-1">Total Credits</p>
        <p className="text-2xl font-bold text-blue-400">
          {formatRupees(balance?.total_credits_paise)}
        </p>
      </div>

      {/* Total Debits */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <p className="text-sm text-gray-400 mb-1">Total Debits</p>
        <p className="text-2xl font-bold text-red-400">
          {formatRupees(balance?.total_debits_paise)}
        </p>
      </div>
    </div>
  );
}