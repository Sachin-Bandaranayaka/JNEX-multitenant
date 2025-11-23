'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { User } from 'next-auth';

const productSchema = z.object({
  code: z.string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be less than 50 characters'),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  price: z.number()
    .min(0, 'Price must be greater than or equal to 0')
    .max(1000000, 'Price must be less than 1,000,000'),
  stock: z.number()
    .min(0, 'Stock must be greater than or equal to 0')
    .max(100000, 'Stock must be less than 100,000'),
  lowStockAlert: z.number()
    .min(0, 'Low stock alert must be greater than or equal to 0')
    .max(100000, 'Low stock alert must be less than 100,000'),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  lowStockAlert: number;
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  user: User;
}

export function ProductForm({ product, onSubmit, onCancel, user }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEditStock = user.role === 'ADMIN' || (user.permissions && user.permissions.includes('EDIT_STOCK_LEVELS'));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      code: product.code,
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: product.stock,
      lowStockAlert: product.lowStockAlert,
    } : {
      code: '',
      name: '',
      description: '',
      price: 0,
      stock: 0,
      lowStockAlert: 5,
    },
  });

  const onSubmitForm = async (data: ProductFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (!canEditStock && product) {
        data.stock = product.stock;
      }
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 p-6">
      {error && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-muted-foreground mb-2">Code</label>
          <input
            type="text"
            id="code"
            {...register('code')}
            disabled={!!product}
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
          {errors.code && <p className="mt-1 text-sm text-destructive px-2">{errors.code.message}</p>}
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
          <input
            type="text"
            id="name"
            {...register('name')}
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {errors.name && <p className="mt-1 text-sm text-destructive px-2">{errors.name.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
          <textarea
            id="description"
            rows={3}
            {...register('description')}
            className="w-full p-4 rounded-3xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
          />
          {errors.description && <p className="mt-1 text-sm text-destructive px-2">{errors.description.message}</p>}
        </div>

        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-muted-foreground mb-2">
            Stock
          </label>
          <input
            type="number"
            id="stock"
            {...register('stock', { valueAsNumber: true })}
            disabled={!canEditStock && !!product}
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
          {!canEditStock && !!product && (
            <p className="mt-1 text-sm text-yellow-500 px-2">You don't have permission to change the stock of existing products.</p>
          )}
          {errors.stock && (
            <p className="mt-1 text-sm text-destructive px-2">{errors.stock.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-muted-foreground mb-2">Price (LKR)</label>
          <input
            type="number"
            id="price"
            step="0.01"
            {...register('price', { valueAsNumber: true })}
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {errors.price && <p className="mt-1 text-sm text-destructive px-2">{errors.price.message}</p>}
        </div>
        <div>
          <label htmlFor="lowStockAlert" className="block text-sm font-medium text-muted-foreground mb-2">Low Stock Alert</label>
          <input
            type="number"
            id="lowStockAlert"
            {...register('lowStockAlert', { valueAsNumber: true })}
            className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {errors.lowStockAlert && <p className="mt-1 text-sm text-destructive px-2">{errors.lowStockAlert.message}</p>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border mt-6">
        <motion.button
          type="button"
          onClick={onCancel}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-12 px-6 rounded-full border border-input text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        >
          Cancel
        </motion.button>
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-12 px-8 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all shadow-sm"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </div>
          ) : (
            product ? 'Update Product' : 'Create Product'
          )}
        </motion.button>
      </div>
    </form>
  );
}