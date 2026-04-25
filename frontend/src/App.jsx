/**
 * Main App — Dashboard layout with all components.
 * 
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  Header (logo + merchant selector)  │
 * ├─────────────────────────────────────┤
 * │  Balance Cards (4 columns)          │
 * ├─────────────────────────────────────┤
 * │  Payout Request Form                │
 * ├─────────────────────────────────────┤
 * │  Payout History (live polling)      │
 * ├─────────────────────────────────────┤
 * │  Ledger Table (paginated)           │
 * └─────────────────────────────────────┘
 */

import { useState, useCallback } from 'react';
import MerchantSelector from './components/MerchantSelector';
import BalanceCard from './components/BalanceCard';
import PayoutForm from './components/PayoutForm';
import PayoutHistory from './components/PayoutHistory';
import LedgerTable from './components/LedgerTable';

function App() {
  const [merchantId, setMerchantId] = useState(null);
  // refreshTrigger increments whenever data should be refreshed
  // (e.g., after creating a payout)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePayoutCreated = useCallback(() => {
    // Increment trigger to refresh all data-fetching components
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Playto Pay</h1>
                <p className="text-xs text-gray-400 -mt-0.5">Payout Engine</p>
              </div>
            </div>

            {/* Merchant Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 hidden sm:inline">Merchant:</span>
              <MerchantSelector
                selectedId={merchantId}
                onSelect={setMerchantId}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {merchantId ? (
          <>
            {/* Balance Cards */}
            <BalanceCard
              merchantId={merchantId}
              refreshTrigger={refreshTrigger}
            />

            {/* Payout Form */}
            <PayoutForm
              merchantId={merchantId}
              onPayoutCreated={handlePayoutCreated}
            />

            {/* Payout History */}
            <PayoutHistory
              merchantId={merchantId}
              refreshTrigger={refreshTrigger}
            />

            {/* Spacer */}
            <div className="my-6"></div>

            {/* Ledger Table */}
            <LedgerTable
              merchantId={merchantId}
              refreshTrigger={refreshTrigger}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500 text-lg">Loading merchants...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-gray-500">
            Playto Payout Engine — Built by Manasvi | Founding Engineer Assignment
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;