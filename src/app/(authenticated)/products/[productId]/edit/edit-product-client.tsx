'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/products/product-form';
import { StockAdjustmentHistory } from '@/components/products/stock-adjustment-history';
import { motion } from 'framer-motion';
import { User } from 'next-auth'; // --- FIX: Import the User type

// Interfaces for Product and StockAdjustment
interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  lowStockAlert: number;
}
interface StockAdjustment {
  id: string;
  quantity: number;
  reason: string;
  previousStock: number;
  newStock: number;
  createdAt: string;
  adjustedBy?: { name: string | null; email: string };
}

// --- FIX: Update the component's props to accept the user object ---
export function EditProductClient({
  product,
  stockAdjustments,
  user, // Accept the full user object
}: {
  product: Product;
  stockAdjustments: StockAdjustment[];
  user: User; // Define the user prop
}) {
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update product');
      }

      router.push('/products');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Edit Product</h1>
          <p className="mt-2 text-sm text-muted-foreground">Update product details and manage stock</p>
        </div>
        <motion.button
          onClick={() => router.back()}
          className="inline-flex items-center px-4 py-2 border border-input rounded-md shadow-sm text-sm font-medium text-muted-foreground bg-card hover:bg-accent hover:text-accent-foreground"
        >
          Back to Products
        </motion.button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg ring-1 ring-border">
          <div className="p-6">
            <ProductForm
              product={product}
              onSubmit={handleSubmit}
              onCancel={() => router.back()}
              // --- FIX: Pass the entire user object to the ProductForm ---
              user={user}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg ring-1 ring-border">
          <div className="p-6">
            <h2 className="text-lg font-medium text-card-foreground mb-4">Stock Adjustment History</h2>
            <StockAdjustmentHistory adjustments={stockAdjustments} />
          </div>
        </div>
      </div>
    </div>
  );
}