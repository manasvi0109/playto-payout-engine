import axios from 'axios';

// ═══════════════════════════════════════════════════
// PRODUCTION BACKEND URL — HARDCODED AS FALLBACK
// This guarantees the frontend ALWAYS knows where
// the backend is, even if env variables are missing.
// ═══════════════════════════════════════════════════
const RENDER_BACKEND = 'https://playto-payout-engine-9smc.onrender.com/api/v1';

function getBaseUrl() {
  // Local development: use Vite proxy
  if (import.meta.env.DEV) {
    console.log('[API] Running in DEV mode — using Vite proxy');
    return '/api/v1';
  }

  // Production: use env variable or hardcoded fallback
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    // Remove trailing slash if present
    const cleanUrl = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    console.log('[API] Using VITE_API_URL:', cleanUrl);
    return cleanUrl;
  }

  console.log('[API] Using hardcoded RENDER_BACKEND:', RENDER_BACKEND);
  return RENDER_BACKEND;
}

const API_BASE = getBaseUrl();
console.log('[API] Final Base URL:', API_BASE);

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// Log every request in development
apiClient.interceptors.request.use((config) => {
  const fullUrl = `${config.baseURL}${config.url}`;
  console.log(`[API] ${config.method?.toUpperCase()} ${fullUrl}`);
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Timeout — Render backend may be cold starting');
    } else if (!error.response) {
      console.error('[API] Network error — check if backend is running');
    } else {
      console.error(`[API] Error ${error.response.status}:`, error.response.data);
    }
    return Promise.reject(error);
  }
);

// ==========================================
// MERCHANT APIs
// ==========================================
export const fetchMerchants = async () => {
  const response = await apiClient.get('/merchants/');
  return response.data;
};

export const fetchMerchant = async (merchantId) => {
  const response = await apiClient.get(`/merchants/${merchantId}/`);
  return response.data;
};

export const fetchBalance = async (merchantId) => {
  const response = await apiClient.get(`/merchants/${merchantId}/balance/`);
  return response.data;
};

export const fetchBankAccounts = async (merchantId) => {
  const response = await apiClient.get(`/merchants/${merchantId}/bank-accounts/`);
  return response.data;
};

// ==========================================
// LEDGER APIs
// ==========================================
export const fetchLedger = async (merchantId, page = 1) => {
  const response = await apiClient.get(`/merchants/${merchantId}/ledger/?page=${page}`);
  return response.data;
};

// ==========================================
// PAYOUT APIs
// ==========================================
export const createPayout = async (data, idempotencyKey) => {
  const response = await apiClient.post('/payouts/', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
};

export const fetchPayouts = async (merchantId) => {
  const response = await apiClient.get(`/payouts/list/?merchant_id=${merchantId}`);
  return response.data;
};

export const fetchPayout = async (payoutId) => {
  const response = await apiClient.get(`/payouts/${payoutId}/`);
  return response.data;
};

export default apiClient;