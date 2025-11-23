// src\app\(authenticated)\products\products-client.tsx

'use client';

import { useState } from 'react';
import { ProductList } from '@/components/products/product-list';
import { ProductForm } from '@/components/products/product-form';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from 'next-auth';
import { PlusIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

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

export function ProductsClient({ initialProducts, user }: { initialProducts: Product[], user: User }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const hasEditPermission = user.role === 'ADMIN' || user.permissions?.includes('EDIT_PRODUCTS');

  const fetchProducts = async () => {
    setError(null);
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    }
  };

  const handleCreateProduct = async (data: any) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }

      setShowCreateForm(false);
      await fetchProducts(); // Refresh the list
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import products');
      }
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import products');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your products, inventory, and pricing
          </p>
        </div>

        {hasEditPermission && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="csv-upload"
              className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors cursor-pointer shadow-sm ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              {isImporting ? 'Importing...' : 'Import CSV'}
              <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={isImporting} />
            </label>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Add Product
            </button>
          </div>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive font-medium text-center"
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {showCreateForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-3xl mx-auto"
          >
            <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h2 className="text-lg font-semibold text-foreground">Create New Product</h2>
              </div>
              <ProductForm user={user} onSubmit={handleCreateProduct} onCancel={() => setShowCreateForm(false)} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-3xl border border-dashed border-border">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <PlusIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No products found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Get started by creating your first product or importing from a CSV file.
                </p>
                {hasEditPermission && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Create Product
                  </button>
                )}
              </div>
            ) : (
              <ProductList products={products} user={user} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}