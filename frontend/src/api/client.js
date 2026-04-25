/**
 * API Client — handles all communication with the Django backend.
 *
 * LOCAL DEV: Vite proxy forwards /api/* to Django (localhost:8000)
 * PRODUCTION: Uses VITE_API_URL environment variable (Render backend URL)
 */

import axios from 'axios';

// Determine base URL
// In production (Vercel): VITE_API_URL = "https://your-backend.onrender.com/api/v1"
// In development: empty string (Vite proxy handles it)
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

console.log('[API Client] Base URL:', API_BASE);

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout (Render free tier cold starts are slow)
});

// Request interceptor — log outgoing requests in development
apiClient.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Request timed out — backend may be cold starting');
    }
    if (error.response?.status === 500) {
      console.error('[API] Server error:', error.response.data);
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
  const response = await apiClient.get(
    `/merchants/${merchantId}/ledger/?page=${page}`
  );
  return response.data;
};

// ==========================================
// PAYOUT APIs
// ==========================================

export const createPayout = async (data, idempotencyKey) => {
  const response = await apiClient.post('/payouts/', data, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
};

export const fetchPayouts = async (merchantId) => {
  const response = await apiClient.get(
    `/payouts/list/?merchant_id=${merchantId}`
  );
  return response.data;
};

export const fetchPayout = async (payoutId) => {
  const response = await apiClient.get(`/payouts/${payoutId}/`);
  return response.data;
};

export default apiClient;