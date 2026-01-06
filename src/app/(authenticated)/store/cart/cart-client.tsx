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
  PhotoIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  TruckIcon,
  ShieldCheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

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
  const [removing, setRemoving] = useState<string | null>(null);
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

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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
      toast.success('Cart updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string, productName: string) => {
    setRemoving(itemId);
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
      toast.success(`${productName} removed from cart`);
    } catch (error) {
      toast.error('Failed to remove item');
    } finally {
      setRemoving(null);
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
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-4 mb-8">
            <Link 
              href="/store" 
              className="p-2.5 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-6 rounded-full bg-muted/50 mb-6">
              <ShoppingCartIcon className="h-16 w-16 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-8 max-w-md">
              Looks like you haven&apos;t added any products yet. Start shopping to fill your cart!
            </p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <ShoppingBagIcon className="h-5 w-5" />
              Browse Store
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/store" 
              className="p-2.5 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
              <p className="text-sm text-muted-foreground">{totalItems} items in your cart</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, height: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-2xl bg-card border border-border p-4 sm:p-5 transition-all duration-300 ${
                    removing === item.id ? 'opacity-50 scale-95' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                      {item.storeProduct.imageUrl ? (
                        <Image
                          src={item.storeProduct.imageUrl}
                          alt={item.storeProduct.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <PhotoIcon className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground text-lg line-clamp-1">
                            {item.storeProduct.name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {item.storeProduct.sku}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id, item.storeProduct.name)}
                          disabled={removing === item.id}
                          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-muted rounded-xl">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={updating === item.id || item.quantity <= 1}
                              className="p-2.5 hover:bg-muted/80 disabled:opacity-40 rounded-l-xl transition-colors"
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <span className="px-4 font-semibold min-w-[3rem] text-center">
                              {updating === item.id ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full mx-auto"
                                />
                              ) : (
                                item.quantity
                              )}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={updating === item.id || item.quantity >= item.storeProduct.stock}
                              className="p-2.5 hover:bg-muted/80 disabled:opacity-40 rounded-r-xl transition-colors"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.storeProduct.stock} available
                          </span>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            LKR {item.storeProduct.price.toLocaleString()} each
                          </p>
                          <p className="text-lg font-bold text-foreground">
                            LKR {(item.quantity * item.storeProduct.price).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Continue Shopping */}
            <Link
              href="/store"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Continue Shopping
            </Link>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-card border border-border p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                  <span className="font-medium">LKR {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium text-green-500">Free</span>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-2xl text-foreground">
                      LKR {total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheckIcon className="h-4 w-4 text-green-500" />
                  Secure Payment
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TruckIcon className="h-4 w-4 text-blue-500" />
                  Fast Delivery
                </div>
              </div>

              <AnimatePresence mode="wait">
                {!showCheckout ? (
                  <motion.button
                    key="checkout-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowCheckout(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20"
                  >
                    <CreditCardIcon className="h-5 w-5" />
                    Proceed to Checkout
                  </motion.button>
                ) : (
                  <motion.form
                    key="checkout-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleCheckout}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCardIcon className="h-5 w-5 text-primary" />
                        <p className="font-semibold text-foreground">Bank Transfer</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Transfer the total amount and provide receipt details below.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Bank Receipt Number
                      </label>
                      <input
                        type="text"
                        required
                        value={checkoutData.bankReceiptNumber}
                        onChange={(e) => setCheckoutData(prev => ({ ...prev, bankReceiptNumber: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Enter receipt number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={checkoutData.whatsappNumber}
                        onChange={(e) => setCheckoutData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="+94 77 123 4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Transfer Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={checkoutData.transferTime}
                        onChange={(e) => setCheckoutData(prev => ({ ...prev, transferTime: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCheckout(false)}
                        className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                            />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-4 w-4" />
                            Place Order
                          </>
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
