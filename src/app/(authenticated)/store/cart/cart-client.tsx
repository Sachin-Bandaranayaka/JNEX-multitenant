'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrashIcon, 
  PlusIcon, 
  MinusIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';

interface CartItem {
  id: string;
  quantity: number;
  storeProduct: {
    id: string;
    name: string;
    price: number;
    stock: number;
    sku: string;
    imageUrl: string | null;
  };
}

interface CartClientProps {
  initialItems: CartItem[];
  initialTotal: number;
}

export function CartClient({ initialItems, initialTotal }: CartClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    bankReceiptNumber: '',
    whatsappNumber: '',
    transferTime: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const recalculateTotal = (updatedItems: CartItem[]) => {
    return updatedItems.reduce(
      (sum, item) => sum + item.quantity * item.storeProduct.price,
      0
    );
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setUpdating(itemId);
    try {
      const response = await fetch(`/api/store/cart/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update quantity');
      }

      setItems(prev => {
        const updated = prev.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        );
        setTotal(recalculateTotal(updated));
        return updated;
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    try {
      const response = await fetch(`/api/store/cart/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove item');

      setItems(prev => {
        const updated = prev.filter(item => item.id !== itemId);
        setTotal(recalculateTotal(updated));
        return updated;
      });
    } catch (error) {
      alert('Failed to remove item');
    } finally {
      setUpdating(null);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/store/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to place order');
      }

      router.push('/store/purchases?success=true');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4">
          <Link href="/store" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-3xl border border-dashed border-border">
          <div className="p-4 rounded-full bg-muted mb-4">
            <ShoppingCartIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">Your cart is empty</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add some products to get started.
          </p>
          <Link
            href="/store"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Browse Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link href="/store" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Product Image */}
                  <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {item.storeProduct.imageUrl ? (
                      <Image
                        src={item.storeProduct.imageUrl}
                        alt={item.storeProduct.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <PhotoIcon className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{item.storeProduct.name}</h3>
                    <p className="text-sm text-muted-foreground">SKU: {item.storeProduct.sku}</p>
                    <p className="text-sm font-medium text-foreground mt-1">
                      LKR {item.storeProduct.price.toLocaleString()} each
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={updating === item.id || item.quantity <= 1}
                        className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updating === item.id || item.quantity >= item.storeProduct.stock}
                        className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <p className="font-semibold text-foreground">
                        LKR {(item.quantity * item.storeProduct.price).toLocaleString()}
                      </p>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={updating === item.id}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-card border border-border p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">LKR {total.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">LKR {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {!showCheckout ? (
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Proceed to Checkout
              </button>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50 text-sm">
                  <p className="font-medium text-foreground mb-2">Bank Transfer Details</p>
                  <p className="text-muted-foreground text-xs">
                    Please transfer the total amount and provide the receipt details below.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Bank Receipt Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={checkoutData.bankReceiptNumber}
                    onChange={(e) => setCheckoutData(prev => ({ ...prev, bankReceiptNumber: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Enter receipt number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={checkoutData.whatsappNumber}
                    onChange={(e) => setCheckoutData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g., +94771234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Transfer Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={checkoutData.transferTime}
                    onChange={(e) => setCheckoutData(prev => ({ ...prev, transferTime: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Placing Order...' : 'Place Order'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
