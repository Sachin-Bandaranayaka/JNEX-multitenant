// src/components/inventory/stock-adjustment-form.tsx

'use client';

import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  stock: number;
}

interface StockAdjustmentFormProps {
  product: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StockAdjustmentForm({ product, onSuccess, onCancel }: StockAdjustmentFormProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity: parseInt(quantity),
          reason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to adjust stock');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <p className="text-sm sm:text-base text-gray-400 mb-4">Current stock for {product.name}: <span className="font-semibold text-white">{product.stock}</span></p>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-400 mb-2">Quantity Change</label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            placeholder="e.g., -5 or 10"
            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation"
          />
        </div>
        
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-400 mb-2">Reason</label>
          <input
            type="text"
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="e.g., Damaged goods, Stock count correction"
            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/50 p-4 text-sm text-red-400 ring-1 ring-red-500">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
        <button 
          type="button" 
          onClick={onCancel} 
          className="inline-flex items-center justify-center rounded-md border border-gray-700 px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium text-gray-400 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 touch-manipulation min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium text-white ring-1 ring-white/10 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation min-h-[44px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Adjusting...
            </>
          ) : (
            'Adjust Stock'
          )}
        </button>
      </div>
    </form>
  );
}