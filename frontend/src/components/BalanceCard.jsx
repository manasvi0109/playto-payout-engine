import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BanknotesIcon,
  LockClosedIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/solid';
import { fetchBalance } from '../api/client';
import { formatRupees } from '../utils/format';

const cards = [
  {
    key: 'available_balance_paise',
    label: 'Available Balance',
    icon: BanknotesIcon,
    color: 'emerald',
    gradient: 'from-emerald-500/20 to-emerald-900/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    textColor: 'text-emerald-300',
    description: 'Ready to withdraw',
  },
  {
    key: 'held_balance_paise',
    label: 'Held Balance',
    icon: LockClosedIcon,
    color: 'amber',
    gradient: 'from-amber-500/20 to-amber-900/10',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    textColor: 'text-amber-300',
    description: 'In transit payouts',
  },
  {
    key: 'total_credits_paise',
    label: 'Total Credits',
    icon: ArrowTrendingUpIcon,
    color: 'blue',
    gradient: 'from-blue-500/20 to-blue-900/10',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    textColor: 'text-blue-300',
    description: 'Payments received',
  },
  {
    key: 'total_debits_paise',
    label: 'Total Debits',
    icon: ArrowTrendingDownIcon,
    color: 'rose',
    gradient: 'from-rose-500/20 to-rose-900/10',
    iconBg: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    textColor: 'text-rose-300',
    description: 'Payouts made',
  },
];

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
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadBalance();
  }, [merchantId, refreshTrigger]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 animate-pulse border border-gray-700/50"
          >
            <div className="h-4 bg-gray-700 rounded w-24 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-36"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 mb-8">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const value = balance?.[card.key] || 0;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className={`
              relative overflow-hidden rounded-2xl p-6 
              bg-gradient-to-br ${card.gradient} 
              border border-gray-700/50 
              backdrop-blur-sm
              hover:border-gray-600/50 transition-all duration-300
              group cursor-default
            `}
          >
            {/* Background decoration */}
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Icon className="h-24 w-24" />
            </div>

            <div className="relative">
              {/* Icon + Label */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`${card.iconBg} p-2 rounded-xl`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">
                    {card.label}
                  </p>
                  <p className="text-xs text-gray-500">{card.description}</p>
                </div>
              </div>

              {/* Value */}
              <motion.p
                key={value}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                className={`text-2xl font-bold ${card.textColor} tracking-tight`}
              >
                {formatRupees(value)}
              </motion.p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}