'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCartIcon, 
  PlusIcon, 
  MinusIcon,
  ShoppingBagIcon 
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  sku: string;
}

interface StoreClientProps {
  initialProducts: StoreProduct[];
  initialCartCount: number;
}

export function StoreClient({ initialProducts, initialCartCount }: StoreClientProps) {
  const [products] = useState<StoreProduct[]>(initialProducts);
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const getQuantity = (productId: string) => quantities[productId] || 1;

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 1;
      const newQty = Math.max(1, current + delta);
      return { ...prev, [productId]: newQty };
    });
  };

  const addToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      const response = await fetch('/api/store/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeProductId: productId,
          quantity: getQuantity(productId),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to cart');
      }

      setCartCount(prev => prev + getQuantity(productId));
      setQuantities(prev => ({ ...prev, [productId]: 1 }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add to cart');
    } finally {
      setAddingToCart(null);
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Store</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and purchase products for your inventory
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/store/purchases"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            My Purchases
          </Link>
          <Link
            href="/store/cart"
            className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ShoppingCartIcon className="h-5 w-5" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-3xl border border-dashed border-border">
          <div className="p-4 rounded-full bg-muted mb-4">
            <ShoppingBagIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No products available</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Check back later for new products.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{product.name}</h3>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      product.stock > 10 
                        ? 'bg-green-500/10 text-green-500' 
                        : product.stock > 0 
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </span>
                  </div>

                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-foreground">
                      LKR {product.price.toLocaleString()}
                    </span>
                  </div>

                  {product.stock > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                          disabled={getQuantity(product.id) <= 1}
                        >
                          <MinusIcon className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center font-medium">
                          {getQuantity(product.id)}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                          disabled={getQuantity(product.id) >= product.stock}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => addToCart(product.id)}
                        disabled={addingToCart === product.id}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <ShoppingCartIcon className="h-4 w-4" />
                        {addingToCart === product.id ? 'Adding...' : 'Add to Cart'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
