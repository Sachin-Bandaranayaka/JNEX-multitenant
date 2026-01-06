// src/app/(authenticated)/orders/orders-client.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OrderActions } from '@/components/orders/order-actions';
import { SyncOrdersButton } from '@/components/orders/sync-orders-button';
import { Prisma } from '@prisma/client';
import { User } from 'next-auth';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';

// Define the types for the props this component will receive
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { product: true; lead: true; assignedTo: true; };
}>;

interface OrdersClientProps {
  initialOrders: OrderWithRelations[];
  user: User;
}

// Status configuration similar to leads page
const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending Orders',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20',
    icon: ClockIcon
  },
  SHIPPED: {
    label: 'Shipped Orders',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
    icon: TruckIcon
  },
  DELIVERED: {
    label: 'Delivered Orders',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/20',
    icon: CheckCircleIcon
  },
};

export function OrdersClient({ initialOrders, user }: OrdersClientProps) {
  // State to keep track of which order IDs are selected
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Group orders by the main categories we want to display
  const ordersByCategory = {
    PENDING: initialOrders.filter(order => ['PENDING', 'CONFIRMED'].includes(order.status)),
    SHIPPED: initialOrders.filter(order => order.status === 'SHIPPED'),
    DELIVERED: initialOrders.filter(order => ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.status)),
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ring-yellow-500/20',
      confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20',
      shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-500/20',
      delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/20',
      returned: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
      cancelled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20',
    };
    return colors[status.toLowerCase() as keyof typeof colors] || colors.pending;
  };

  // Handler for changing a single checkbox's state
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId) // Uncheck: remove from array
        : [...prev, orderId] // Check: add to array
    );
  };

  // Handler for the "Select All" checkbox in each section
  const handleSelectAllByCategory = (ordersInSection: OrderWithRelations[]) => {
    const orderIdsInSection = ordersInSection.map(order => order.id);
    // Check if all orders in this section are already selected
    const allSelected = orderIdsInSection.every(id => selectedOrders.includes(id));

    if (allSelected) {
      // If all are selected, deselect them
      setSelectedOrders(prev => prev.filter(id => !orderIdsInSection.includes(id)));
    } else {
      // Otherwise, select all (ensuring no duplicates)
      setSelectedOrders(prev => [...new Set([...prev, ...orderIdsInSection])]);
    }
  };

  const canPrintInvoices = user.role === 'ADMIN' || user.permissions?.includes('CREATE_ORDERS') || user.permissions?.includes('EDIT_ORDERS');

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      {canPrintInvoices && (
        <div className="flex justify-between items-center">
          {/* Sync Button - Only show for admins */}
          {user.role === 'ADMIN' && (
            <SyncOrdersButton />
          )}
          {user.role !== 'ADMIN' && <div />}
          
          <Link
            href={selectedOrders.length > 0 ? `/orders/print?ids=${selectedOrders.join(',')}` : '#'}
            aria-disabled={selectedOrders.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm ${selectedOrders.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md'
              }`}
            onClick={(e) => {
              if (selectedOrders.length === 0) e.preventDefault();
            }}
          >
            <PrinterIcon className="h-4 w-4" />
            Print Selected ({selectedOrders.length})
          </Link>
        </div>
      )}

      {initialOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/30 rounded-3xl border border-dashed border-border">
          <div className="p-4 rounded-full bg-muted mb-4">
            <TruckIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No orders found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Object.entries(STATUS_CONFIG).map(([category, config]) => {
            const categoryOrders = ordersByCategory[category as keyof typeof ordersByCategory] || [];

            // Check if all orders in this category are selected
            const areAllInCategorySelected = categoryOrders.length > 0 && categoryOrders.every(order => selectedOrders.includes(order.id));

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-full bg-card rounded-3xl border border-border shadow-sm overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ring-1 inset-0 ${config.color}`}>
                      <config.icon className="h-5 w-5" />
                    </div>
                    <h2 className="font-semibold text-foreground">{config.label}</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    {categoryOrders.length}
                  </span>
                </div>

                {/* Select All Bar */}
                {categoryOrders.length > 0 && (
                  <div className="px-6 py-2 border-b border-border/50 bg-muted/10 flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      onChange={() => handleSelectAllByCategory(categoryOrders)}
                      checked={areAllInCategorySelected}
                    />
                    <label className="text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => handleSelectAllByCategory(categoryOrders)}>
                      Select All
                    </label>
                  </div>
                )}

                {/* Order List */}
                <div className="flex-1 p-4 overflow-y-auto max-h-[600px] custom-scrollbar">
                  <ul className="space-y-3">
                    {categoryOrders.map((order) => (
                      <motion.li
                        key={order.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group relative bg-background rounded-2xl border border-border p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200"
                      >
                        <div className="flex items-start gap-4">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                              checked={selectedOrders.includes(order.id)}
                              onChange={() => handleSelectOrder(order.id)}
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <Link
                                  href={`/orders/${order.id}`}
                                  className="text-sm font-bold text-foreground hover:text-primary transition-colors block truncate"
                                >
                                  Order #{order.number || order.id.slice(0, 8)}
                                </Link>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 inset-0 ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {order.product.name}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate max-w-[60%]">{order.customerName}</span>
                                {order.total > 0 && (
                                  <span className="font-semibold text-foreground">
                                    LKR {order.total.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <OrderActions order={order} user={user} />
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                    {categoryOrders.length === 0 && (
                      <li className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">No orders in this category</p>
                      </li>
                    )}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
