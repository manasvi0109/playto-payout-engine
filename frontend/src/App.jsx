import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoltIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  CommandLineIcon,
} from '@heroicons/react/24/solid';
import MerchantSelector from './components/MerchantSelector';
import BalanceCard from './components/BalanceCard';
import PayoutForm from './components/PayoutForm';
import PayoutHistory from './components/PayoutHistory';
import LedgerTable from './components/LedgerTable';
import ConnectionStatus from './components/ConnectionStatus';


function App() {
  const [merchantId, setMerchantId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second (shows liveness)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePayoutCreated = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleMerchantChange = useCallback((id) => {
    setMerchantId(id);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white antialiased">
       {/* Connection Status Banner */}
      <ConnectionStatus />
      {/* ════════════════════════════════════════════ */}
      {/* Background Pattern */}
      {/* ════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* Header */}
      {/* ════════════════════════════════════════════ */}
      <header className="relative bg-gray-900/60 backdrop-blur-2xl border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left — Logo */}
            <div className="flex items-center gap-3">
              {/* Animated Logo */}
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <BoltIcon className="h-5 w-5 text-white" />
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-xl -z-10" />
              </motion.div>

              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Playto
                  <span className="text-blue-400"> Pay</span>
                </h1>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                    Payout Engine
                  </p>
                </div>
              </div>
            </div>

            {/* Center — Status indicators (hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-6">
              <StatusIndicator
                icon={ShieldCheckIcon}
                label="Secure"
                color="emerald"
              />
              <StatusIndicator
                icon={GlobeAltIcon}
                label="Connected"
                color="blue"
              />
              <StatusIndicator
                icon={CommandLineIcon}
                label="API v1"
                color="purple"
              />
            </div>

            {/* Right — Merchant Selector + Clock */}
            <div className="flex items-center gap-4">
              {/* Live Clock */}
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-500 font-mono">
                  {currentTime.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </p>
                <p className="text-[10px] text-gray-600">
                  {currentTime.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="w-px h-8 bg-gray-700/50 hidden sm:block" />

              <MerchantSelector
                selectedId={merchantId}
                onSelect={handleMerchantChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════ */}
      {/* Main Content */}
      {/* ════════════════════════════════════════════ */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {merchantId ? (
            <motion.div
              key={merchantId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Section: Balance Overview */}
              <SectionHeader
                title="Balance Overview"
                subtitle="Real-time financial summary"
                icon={BoltIcon}
              />
              <BalanceCard
                merchantId={merchantId}
                refreshTrigger={refreshTrigger}
              />

              {/* Section: Request Payout */}
              <PayoutForm
                merchantId={merchantId}
                onPayoutCreated={handlePayoutCreated}
              />

              {/* Section: Payout History */}
              <PayoutHistory
                merchantId={merchantId}
                refreshTrigger={refreshTrigger}
              />

              {/* Section: Transaction Ledger */}
              <LedgerTable
                merchantId={merchantId}
                refreshTrigger={refreshTrigger}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-[60vh] gap-4"
            >
              <div className="relative">
                <ArrowPathIcon className="h-16 w-16 text-gray-700 animate-spin" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl" />
              </div>
              <p className="text-gray-500 text-lg font-medium">
                Loading merchants...
              </p>
              <p className="text-gray-600 text-sm">
                Connecting to Playto Pay engine
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ════════════════════════════════════════════ */}
      {/* Footer */}
      {/* ════════════════════════════════════════════ */}
      <footer className="relative bg-gray-900/40 backdrop-blur-xl border-t border-gray-800/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <BoltIcon className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-gray-500">
                Playto Payout Engine
              </span>
            </div>

            <div className="flex items-center gap-6">
              <FooterLink label="API Docs" href="/api/v1/" />
              <FooterLink label="Admin" href="/admin/" />
              <span className="text-xs text-gray-600">
                Built by Manasvi · Founding Engineer Assignment
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* Sub-Components (defined in same file for simplicity) */
/* ═══════════════════════════════════════════════════ */

function StatusIndicator({ icon: Icon, label, color }) {
  const colors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colors[color]}`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${colors[color]}`}
        />
      </div>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function FooterLink({ label, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      {label}
    </a>
  );
}

export default App;