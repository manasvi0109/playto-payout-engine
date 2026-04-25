/**
 * ConnectionStatus — Shows when backend is cold-starting or unreachable.
 * Render free tier takes 30-60 seconds to wake up.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking'); // checking, connected, error
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
        const response = await fetch(`${baseUrl}/merchants/`, {
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          setStatus('connected');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        console.warn('[ConnectionStatus] Backend not ready:', err.message);
        setStatus('error');
        // Auto-retry every 5 seconds
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          setStatus('checking');
        }, 5000);
      }
    };

    if (status === 'checking') {
      checkConnection();
    }
  }, [status, retryCount]);

  return (
    <AnimatePresence>
      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-300 font-medium">
                Backend is waking up...
              </p>
              <p className="text-xs text-amber-400/60">
                Free tier cold start — retrying automatically (attempt{' '}
                {retryCount + 1})
              </p>
            </div>
            <ArrowPathIcon className="h-4 w-4 text-amber-400 animate-spin" />
          </div>
        </motion.div>
      )}

      {status === 'checking' && retryCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-300 font-medium">
              Reconnecting to backend...
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}