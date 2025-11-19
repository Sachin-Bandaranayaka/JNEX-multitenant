'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { User } from 'next-auth';
import { toast } from 'sonner'; // Import toast for notifications

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
  const [sortField, setSortField] = useState<keyof Product>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const router = useRouter();

  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_PRODUCTS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_PRODUCTS');

  const sortedProducts = [...products].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const direction = sortDirection === 'asc' ? 1 : -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * direction;
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction;
    }
    return 0;
  });

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStockStatusColor = (stock: number, lowStockAlert: number) => {
    if (stock === 0) return 'bg-red-900/50 text-red-300 ring-red-500/50';
    if (stock <= lowStockAlert) return 'bg-yellow-900/50 text-yellow-300 ring-yellow-500/50';
    return 'bg-green-900/50 text-green-300 ring-green-500/50';
  };

  // --- FIX: Updated delete function with clear user feedback ---
  const deleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      // If the API returns an error, parse it and throw it to be caught below
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate product');
      }

      // On success, show a success message and refresh the page data
      toast.success('Product has been deactivated.');
      router.refresh();
    } catch (err) {
      // Display the specific error from the API in a toast notification
      toast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error('Error deactivating product:', err);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th onClick={() => handleSort('code')} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">Code</th>
            <th onClick={() => handleSort('name')} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">Name</th>
            <th onClick={() => handleSort('price')} className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">Price</th>
            <th onClick={() => handleSort('stock')} className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">Stock</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity</th>
            {(canEdit || canDelete) && (
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedProducts.map((product) => (
            <motion.tr key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-accent/50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">{product.code}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-foreground">{product.name}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-card-foreground">
                {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(product.price)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStockStatusColor(product.stock, product.lowStockAlert)}`}>
                  {product.stock}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
                {product.totalOrders} orders, {product.totalLeads} leads
              </td>
              {(canEdit || canDelete) && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-3">
                  {canEdit && (
                    <Link href={`/products/${product.id}/edit`} className="text-primary hover:text-primary/80">Edit</Link>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to deactivate this product? It will be hidden from all lists but its data will be preserved.')) {
                          deleteProduct(product.id);
                        }
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
