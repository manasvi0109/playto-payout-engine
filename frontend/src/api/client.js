/**
 * API Client — handles all communication with the Django backend.
 * 
 * Uses axios for HTTP requests.
 * In development, Vite proxy forwards /api/* to Django.
 * In production, we use the full URL.
 */

import axios from 'axios';

// Base URL for API requests
// In dev: Vite proxy handles /api → Django
// In prod: Use environment variable
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// ==========================================
// MERCHANT APIs
// ==========================================

/**
 * Fetch all merchants.
 * GET /api/v1/merchants/
 */
export const fetchMerchants = async () => {
  const response = await apiClient.get('/merchants/');
  return response.data;
};

/**
 * Fetch single merchant details.
 * GET /api/v1/merchants/{id}/
 */
export const fetchMerchant = async (merchantId) => {
  const response = await apiClient.get(`/merchants/${merchantId}/`);
  return response.data;
};

/**
 * Fetch merchant balance.
 * GET /api/v1/merchants/{id}/balance/
 */
export const fetchBalance = async (merchantId) => {
  const response = await apiClient.get(`/merchants/${merchantId}/balance/`);
  return response.data;
};

/**
 * Fetch merchant's bank accounts.
 * GET /api/v1/merchants/{id}/bank-accounts/
 */
export const fetchBankAccounts = async (merchantId) => {
  const response = await apiClient.get(`/merchants/${merchantId}/bank-accounts/`);
  return response.data;
};

// ==========================================
// LEDGER APIs
// ==========================================

/**
 * Fetch merchant's ledger entries (paginated).
 * GET /api/v1/merchants/{id}/ledger/
 */
export const fetchLedger = async (merchantId, page = 1) => {
  const response = await apiClient.get(`/merchants/${merchantId}/ledger/?page=${page}`);
  return response.data;
};

// ==========================================
// PAYOUT APIs
// ==========================================

/**
 * Create a new payout request.
 * POST /api/v1/payouts/
 * 
 * @param {Object} data - { merchant_id, amount_paise, bank_account_id }
 * @param {string} idempotencyKey - UUID to prevent duplicate payouts
 */
export const createPayout = async (data, idempotencyKey) => {
  const response = await apiClient.post('/payouts/', data, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return response.data;
};

/**
 * Fetch payouts for a merchant.
 * GET /api/v1/payouts/list/?merchant_id={id}
 */
export const fetchPayouts = async (merchantId) => {
  const response = await apiClient.get(`/payouts/list/?merchant_id=${merchantId}`);
  return response.data;
};

/**
 * Fetch a single payout by ID.
 * GET /api/v1/payouts/{id}/
 */
export const fetchPayout = async (payoutId) => {
  const response = await apiClient.get(`/payouts/${payoutId}/`);
  return response.data;
};

export default apiClient;