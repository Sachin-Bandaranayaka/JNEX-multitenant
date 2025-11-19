// src\app\(authenticated)\products\products-client.tsx

'use client';

import { useState } from 'react';
import { ProductList } from '@/components/products/product-list';
import { ProductForm } from '@/components/products/product-form';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from 'next-auth';

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
    <div className="container mx-auto px-4 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your products, inventory, and pricing
          </p>
        </div>

        {hasEditPermission && (
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <label
              htmlFor="csv-upload"
              className={`inline-flex items-center justify-center rounded-md border border-input bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground ring-1 ring-border hover:bg-secondary/80 ${isImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isImporting ? 'Importing...' : 'Import CSV'}
              <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={isImporting} />
            </label>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-border hover:bg-primary/90"
            >
              Add Product
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 p-4">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showCreateForm ? (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mt-8">
            <div className="rounded-lg bg-card p-6 ring-1 ring-border">
              <h2 className="text-lg font-medium text-card-foreground mb-6">Create New Product</h2>
              {/* --- FIX: Pass the 'user' object to the ProductForm component --- */}
              <ProductForm user={user} onSubmit={handleCreateProduct} onCancel={() => setShowCreateForm(false)} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
            {products.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">No products found</p>
                {hasEditPermission && (
                  <button onClick={() => setShowCreateForm(true)} className="mt-4 inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-1 ring-border hover:bg-primary/90">
                    Create your first product
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-card ring-1 ring-border rounded-lg overflow-hidden">
                <ProductList products={products} user={user} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}