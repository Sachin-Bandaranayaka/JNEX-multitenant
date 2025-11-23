// src/components/inventory/stock-adjustment-form.tsx

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 rounded-2xl bg-muted/30 border border-border">
        <p className="text-sm text-muted-foreground text-center">
          Current stock for <span className="font-semibold text-foreground">{product.name}</span>
        </p>
        <p className="text-3xl font-bold text-center text-foreground mt-1">{product.stock}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-muted-foreground mb-2">Quantity Change</label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            placeholder="e.g., -5 or 10"
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <p className="mt-1.5 text-xs text-muted-foreground px-2">
            Use negative numbers to decrease stock (e.g. -5)
          </p>
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-muted-foreground mb-2">Reason</label>
          <input
            type="text"
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="e.g., Damaged goods, Stock count correction"
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20 text-center"
        >
          {error}
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 px-6 rounded-full border border-input text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="h-12 px-8 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all shadow-sm"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Adjusting...</span>
            </div>
          ) : (
            'Adjust Stock'
          )}
        </button>
      </div>
    </form>
  );
}