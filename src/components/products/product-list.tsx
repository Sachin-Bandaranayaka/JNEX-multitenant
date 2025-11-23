'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'next-auth';
import { toast } from 'sonner';
import {
  PencilSquareIcon,
  TrashIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  lowStockAlert: number;
  totalOrders: number;
  totalLeads: number;
  lastStockUpdate: string;
}

interface ProductListProps {
  products: Product[];
  user: User;
}

export function ProductList({ products, user }: ProductListProps) {
  const router = useRouter();

  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_PRODUCTS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_PRODUCTS');

  const getStockStatusColor = (stock: number, lowStockAlert: number) => {
    if (stock === 0) return 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20';
    if (stock <= lowStockAlert) return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20';
    return 'bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/20';
  };

  const deleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate product');
      }

      toast.success('Product has been deactivated.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error('Error deactivating product:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group relative bg-card rounded-3xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
        >
          {/* Card Header */}
          <div className="p-6 border-b border-border bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <CubeIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground line-clamp-1" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {product.code}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 inset-0 ${getStockStatusColor(product.stock, product.lowStockAlert)}`}>
                {product.stock} in stock
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CurrencyDollarIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Price</span>
              </div>
              <span className="text-lg font-bold text-foreground">
                {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(product.price)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ChartBarIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Activity</span>
              </div>
              <div className="text-right text-sm">
                <span className="text-foreground font-medium">{product.totalOrders}</span> orders
                <span className="mx-1 text-muted-foreground">•</span>
                <span className="text-foreground font-medium">{product.totalLeads}</span> leads
              </div>
            </div>

            {product.stock <= product.lowStockAlert && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Low stock alert (Threshold: {product.lowStockAlert})
              </div>
            )}
          </div>

          {/* Card Footer / Actions */}
          {(canEdit || canDelete) && (
            <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <Link
                  href={`/products/${product.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" />
                  Edit
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to deactivate this product? It will be hidden from all lists but its data will be preserved.')) {
                      deleteProduct(product.id);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
