import { useState, useEffect } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/solid';
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
      <div className="h-10 w-48 bg-gray-700/50 rounded-xl animate-pulse"></div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <UserGroupIcon className="h-4 w-4 text-gray-500" />
      </div>
      <select
        value={selectedId || ''}
        onChange={(e) => onSelect(parseInt(e.target.value))}
        className="appearance-none bg-gray-700/50 border border-gray-600/50 rounded-xl 
                   pl-9 pr-10 py-2.5 text-white text-sm font-medium
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                   transition-all duration-200 cursor-pointer
                   hover:bg-gray-700/70"
      >
        {merchants.map((merchant) => (
          <option key={merchant.id} value={merchant.id}>
            {merchant.name}
          </option>
        ))}
      </select>
      {/* Custom dropdown arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}