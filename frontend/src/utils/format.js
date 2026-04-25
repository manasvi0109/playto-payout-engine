/**
 * Formatting utilities used across the app.
 * Centralizing these prevents inconsistency.
 */

/**
 * Format paise amount to Indian Rupee string.
 * 50000 → "₹500.00"
 * 1234567 → "₹12,345.67"
 */
export function formatRupees(paise) {
  if (paise === null || paise === undefined) return '₹0.00';
  const rupees = Math.abs(paise) / 100;
  const formatted = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return paise < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

/**
 * Format paise to short form.
 * 10000000 → "₹1.00L"
 * 5000000 → "₹50.00K"
 */
export function formatRupeesShort(paise) {
  if (!paise) return '₹0';
  const rupees = Math.abs(paise) / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toFixed(2)}`;
}

/**
 * Format date to readable string.
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date to relative time.
 * "2 minutes ago", "1 hour ago", etc.
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return '—';
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}