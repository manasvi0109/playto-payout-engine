/**
 * ConnectionStatus — Shows banner only during cold start.
 * Disappears the moment ANY successful API call is made.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking'); // checking | connected | error
  const [retryCount, setRetryCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // If already connected or dismissed, do nothing
    if (status === 'connected' || dismissed) return;

    const checkConnection = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
        
        // Use a simple fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`${baseUrl}/merchants/`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // ANY response from backend means it's alive (even 500)
        if (response.status < 502) {
          setStatus('connected');
          // Auto-hide after showing "connected" briefly
          setTimeout(() => setDismissed(true), 2000);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        // Only show error if it's a network/timeout error
        if (err.name === 'AbortError' || err.message.includes('fetch')) {
          setStatus('error');
          // Retry after 5 seconds
          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            setStatus('checking');
          }, 5000);
        } else {
          // Backend responded but with an error — it's still alive
          setStatus('connected');
          setTimeout(() => setDismissed(true), 2000);
        }
      }
    };

    checkConnection();
  }, [status, retryCount, dismissed]);

  // Don't render anything if connected and dismissed, or if first check succeeds fast
  if (dismissed) return null;
  if (status === 'connected' && retryCount === 0) return null;

  return (
    <AnimatePresence>
      {/* Error state — backend not reachable */}
      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-300 font-medium">
                Backend is waking up...
              </p>
              <p className="text-xs text-amber-400/60">
                Free tier cold start — retrying (attempt {retryCount + 1})
              </p>
            </div>
            <ArrowPathIcon className="h-4 w-4 text-amber-400 animate-spin flex-shrink-0" />
            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="text-amber-400/60 hover:text-amber-300 text-xs ml-1"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}

      {/* Checking state (retry in progress) */}
      {status === 'checking' && retryCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-300 font-medium">
              Reconnecting to backend...
            </p>
          </div>
        </motion.div>
      )}

      {/* Connected state — brief success flash */}
      {status === 'connected' && retryCount > 0 && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">
              Connected to backend!
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}