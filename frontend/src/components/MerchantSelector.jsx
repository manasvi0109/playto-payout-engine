/**
 * MerchantSelector — Dropdown to switch between merchants.
 * 
 * In a real app, this would be replaced by auth (each merchant
 * sees only their own dashboard). For the assignment demo,
 * this lets evaluators switch between test merchants.
 */

import { useState, useEffect } from 'react';
import { fetchMerchants } from '../api/client';

export default function MerchantSelector({ selectedId, onSelect }) {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMerchants = async () => {
      try {
        const data = await fetchMerchants();
        const merchantList = data.results || data;
        setMerchants(merchantList);
        
        // Auto-select first merchant if none selected
        if (!selectedId && merchantList.length > 0) {
          onSelect(merchantList[0].id);
        }
      } catch (err) {
        console.error('Failed to load merchants:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMerchants();
  }, []);

  if (loading) {
    return (
      <div className="h-10 w-64 bg-gray-700 rounded-lg animate-pulse"></div>
    );
  }

  return (
    <select
      value={selectedId || ''}
      onChange={(e) => onSelect(parseInt(e.target.value))}
      className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white 
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 text-sm font-medium"
    >
      {merchants.map((merchant) => (
        <option key={merchant.id} value={merchant.id}>
          {merchant.name}
        </option>
      ))}
    </select>
  );
}