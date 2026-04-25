import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';

const RENDER_BACKEND = 'https://playto-payout-engine-9smc.onrender.com/api/v1';

function getCheckUrl() {
  if (import.meta.env.DEV) return '/api/v1';
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return RENDER_BACKEND;
}

export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking');
  const [retryCount, setRetryCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status === 'connected' || dismissed) return;

    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const url = `${getCheckUrl()}/merchants/`;
        
        console.log('[ConnectionStatus] Checking:', url);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        console.log('[ConnectionStatus] Response status:', response.status);
        
        // Any response from our backend means it's alive
        if (response.status < 502) {
          setStatus('connected');
          setTimeout(() => setDismissed(true), 1500);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        console.log('[ConnectionStatus] Error:', err.message);
        setStatus('error');
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          setStatus('checking');
        }, 5000);
      }
    };

    checkConnection();
  }, [status, retryCount, dismissed]);

  if (dismissed) return null;
  if (status === 'connected' && retryCount === 0) return null;

  return (
    <AnimatePresence>
      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-300 font-medium">Waking up backend...</p>
              <p className="text-xs text-amber-400/60">Render free tier — retry #{retryCount + 1}</p>
            </div>
            <ArrowPathIcon className="h-4 w-4 text-amber-400 animate-spin" />
            <button onClick={() => setDismissed(true)} className="text-amber-400/40 hover:text-amber-300 text-lg">×</button>
          </div>
        </motion.div>
      )}
      {status === 'checking' && retryCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin" />
            <p className="text-sm text-blue-300">Reconnecting...</p>
          </div>
        </motion.div>
      )}
      {status === 'connected' && retryCount > 0 && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl backdrop-blur-xl shadow-2xl">
            <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-emerald-300">Connected!</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}