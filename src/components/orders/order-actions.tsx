'use client';

import { useState } from 'react';
import { User } from 'next-auth';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

interface OrderActionsProps {
  order: any;
  user: User;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function OrderActions({ order, user }: OrderActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_ORDERS');
  const canGenerateInvoice = user.role === 'ADMIN' || user.permissions?.includes('EDIT_ORDERS') || user.permissions?.includes('CREATE_ORDERS');

  const handleStatusUpdate = async (status: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update order status');
      }
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <select
          value={order.status}
          onChange={(e) => handleStatusUpdate(e.target.value)}
          disabled={isLoading}
          className="rounded-lg border border-border bg-background text-foreground py-1.5 pl-3 pr-8 text-xs font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {canGenerateInvoice && (
        <button
          onClick={() => window.open(`/api/orders/${order.id}/invoice`, '_blank')}
          title="View Invoice"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <DocumentTextIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
