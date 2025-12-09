'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ShoppingBagIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  sku: string;
  isActive: boolean;
  createdAt: string | Date;
}

interface StoreManagementClientProps {
  initialProducts: StoreProduct[];
  pendingCount: number;
}

export function StoreManagementClient({ initialProducts, pendingCount }: StoreManagementClientProps) {
  const [products, setProducts] = useState<StoreProduct[]>(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    sku: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', stock: '', sku: '' });
    setEditingProduct(null);
    setShowForm(false);
  };

  const openEditForm = (product: StoreProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      sku: product.sku,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        sku: formData.sku,
      };

      const url = editingProduct 
        ? `/api/store/products/${editingProduct.id}`
        : '/api/store/products';
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save product');
      }

      const savedProduct = await response.json();

      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === savedProduct.id ? savedProduct : p));
      } else {
        setProducts(prev => [savedProduct, ...prev]);
      }

      resetForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setDeleting(productId);
    try {
      const response = await fetch(`/api/store/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete product');

      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      alert('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Store Management</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage products available for tenant purchase
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/store/purchases"
            className="relative inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
          >
            <ClipboardDocumentListIcon className="h-5 w-5" />
            Purchases
            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-black">
                {pendingCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Product
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-xl bg-gray-800/80 ring-1 ring-white/10 p-6"
          >
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 px-3 py-2 text-white placeholder-gray-400"
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 px-3 py-2 text-white placeholder-gray-400"
                    placeholder="e.g., PROD-001"
                    disabled={!!editingProduct}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Price (LKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 px-3 py-2 text-white placeholder-gray-400"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full rounded-lg bg-gray-700 border-gray-600 px-3 py-2 text-white placeholder-gray-400"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg bg-gray-700 border-gray-600 px-3 py-2 text-white placeholder-gray-400"
                  placeholder="Product description (optional)"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl bg-gray-800/50 ring-1 ring-white/10">
          <div className="p-4 rounded-full bg-gray-700 mb-4">
            <ShoppingBagIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white">No products yet</h3>
          <p className="text-sm text-gray-400 mt-1">
            Add your first product to the store.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-800/80 ring-1 ring-white/10 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-gray-400 truncate max-w-xs">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{product.sku}</td>
                  <td className="px-6 py-4 text-sm text-white font-medium">
                    LKR {product.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${
                      product.stock > 10 ? 'text-green-400' : 
                      product.stock > 0 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      product.isActive 
                        ? 'bg-green-500/10 text-green-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditForm(product)}
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deleting === product.id}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
