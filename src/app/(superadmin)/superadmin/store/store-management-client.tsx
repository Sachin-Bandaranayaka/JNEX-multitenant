'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ShoppingBagIcon,
  ClipboardDocumentListIcon,
  PhotoIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';
import { Badge, Card, PageHeader, saBtnGhost, saBtnPrimary, saCard, saInput, saLabel, saTable, saTd, saTh, saThead, saTr } from '../ui';

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  sku: string;
  imageUrl: string | null;
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
    imageUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', stock: '', sku: '', imageUrl: '' });
    setEditingProduct(null);
    setShowForm(false);
    setImagePreview(null);
  };

  const openEditForm = (product: StoreProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      sku: product.sku,
      imageUrl: product.imageUrl || '',
    });
    setImagePreview(product.imageUrl);
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      // Get presigned URL
      const response = await fetch('/api/store/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get upload URL');
      }

      const { uploadUrl, publicUrl } = await response.json();

      // Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
      setImagePreview(publicUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, imageUrl: '' }));
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        imageUrl: formData.imageUrl || null,
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
      <PageHeader
        eyebrow="Platform store"
        title="Store management"
        description="Manage the products tenants can purchase from the platform."
      >
        <Link href="/superadmin/store/purchases" className={`relative ${saBtnGhost}`}>
          <ClipboardDocumentListIcon className="h-5 w-5 text-slate-500" />
          Purchases
          {pendingCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e10600] px-1 text-[11px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </Link>
        <button onClick={() => setShowForm(true)} className={saBtnPrimary}>
          <PlusIcon className="h-5 w-5" />
          Add product
        </button>
      </PageHeader>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`${saCard} p-5`}
          >
            <h2 className="mb-1 font-bold text-slate-900">
              {editingProduct ? 'Edit product' : 'Add new product'}
            </h2>
            <p className="mb-5 text-xs text-slate-500">Products appear in every tenant&apos;s store once saved.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload Section */}
              <div>
                <label className={`${saLabel} mb-2`}>Product image</label>
                <div className="flex items-start gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <div className="relative h-32 w-32 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                        <Image
                          src={imagePreview}
                          alt="Product preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -right-2 -top-2 rounded-full bg-[#e10600] p-1 text-white transition-colors hover:bg-[#ba0500]"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-slate-400"
                    >
                      {uploading ? (
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#e10600]" />
                      ) : (
                        <>
                          <PhotoIcon className="h-8 w-8 text-slate-400" />
                          <span className="mt-1 text-xs font-semibold text-slate-500">Upload</span>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="text-sm text-slate-600">
                    <p>Click to upload product image</p>
                    <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, GIF (max 5MB)</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`${saLabel} mb-1.5`}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={saInput}
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className={`${saLabel} mb-1.5`}>
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className={saInput}
                    placeholder="e.g., PROD-001"
                    disabled={!!editingProduct}
                  />
                </div>
                <div>
                  <label className={`${saLabel} mb-1.5`}>
                    Price (LKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className={saInput}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={`${saLabel} mb-1.5`}>
                    Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                    className={saInput}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className={`${saLabel} mb-1.5`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={saInput}
                  placeholder="Product description (optional)"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className={saBtnGhost}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className={saBtnPrimary}
                >
                  {submitting ? 'Saving…' : editingProduct ? 'Update product' : 'Add product'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {products.length === 0 ? (
        <div className={`${saCard} flex flex-col items-center justify-center px-5 py-16 text-center`}>
          <div className="mb-4 rounded-full bg-slate-100 p-4">
            <ShoppingBagIcon className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-900">No products yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add your first product to the store.
          </p>
        </div>
      ) : (
        <Card flush>
          <div className="overflow-x-auto">
          <table className={saTable}>
            <thead className={saThead}>
              <tr>
                <th className={saTh}>
                  Product
                </th>
                <th className={saTh}>
                  SKU
                </th>
                <th className={saTh}>
                  Price
                </th>
                <th className={saTh}>
                  Stock
                </th>
                <th className={saTh}>
                  Status
                </th>
                <th className={`${saTh} text-right`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((product) => (
                <tr key={product.id} className={saTr}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100">
                          <PhotoIcon className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{product.name}</p>
                        {product.description && (
                          <p className="max-w-xs truncate text-sm text-slate-500">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`${saTd} font-mono text-xs`}>{product.sku}</td>
                  <td className={`${saTd} font-semibold tabular-nums text-slate-900`}>
                    LKR {product.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-bold tabular-nums ${
                      product.stock > 10 ? 'text-emerald-700' :
                      product.stock > 0 ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={product.isActive ? 'green' : 'red'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditForm(product)}
                        aria-label={`Edit ${product.name}`}
                        className="rounded-md border border-slate-300 p-2 text-slate-600 transition-colors hover:border-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deleting === product.id}
                        aria-label={`Delete ${product.name}`}
                        className="rounded-md border border-slate-300 p-2 text-slate-600 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
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
        </Card>
      )}
    </div>
  );
}
