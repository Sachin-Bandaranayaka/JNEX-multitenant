// src/app/(authenticated)/orders/orders-client.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OrderActions } from '@/components/orders/order-actions';
import { SyncOrdersButton } from '@/components/orders/sync-orders-button';
import { Prisma } from '@prisma/client';
import { User } from 'next-auth';
import { toast } from 'sonner';
import {
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  PrinterIcon,
  XCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { product: true; lead: true; assignedTo: true; };
}>;

interface OrdersClientProps {
  initialOrders: OrderWithRelations[];
  user: User;
  tenantConfig?: {
    hasTransExpress: boolean;
  };
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ring-yellow-500/20',
    rowColor: 'border-l-4 border-yellow-400 bg-yellow-50/40 dark:bg-yellow-900/10',
    filterActive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ring-1 ring-yellow-400/50',
    icon: ClockIcon
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20',
    rowColor: 'border-l-4 border-blue-400 bg-blue-50/40 dark:bg-blue-900/10',
    filterActive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-400/50',
    icon: CheckCircleIcon
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-500/20',
    rowColor: 'border-l-4 border-purple-400 bg-purple-50/40 dark:bg-purple-900/10',
    filterActive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-1 ring-purple-400/50',
    icon: TruckIcon
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/20',
    rowColor: 'border-l-4 border-green-400 bg-green-50/40 dark:bg-green-900/10',
    filterActive: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-400/50',
    icon: CheckCircleIcon
  },
  RETURNED: {
    label: 'Returned',
    color: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
    rowColor: 'border-l-4 border-red-400 bg-red-50/40 dark:bg-red-900/10',
    filterActive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-400/50',
    icon: ArrowPathIcon
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20',
    rowColor: 'border-l-4 border-gray-400 bg-gray-50/40 dark:bg-gray-900/10',
    filterActive: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 ring-1 ring-gray-400/50',
    icon: XCircleIcon
  },
};

// Category groups for the filter tabs
const CATEGORY_CONFIG = {
  ALL: { label: 'All', statuses: null },
  PENDING: { label: 'Pending', statuses: ['PENDING', 'CONFIRMED'] },
  SHIPPED: { label: 'Shipped', statuses: ['SHIPPED'] },
  DELIVERED: { label: 'Delivered', statuses: ['DELIVERED', 'RETURNED', 'CANCELLED'] },
};

// --- Bulk Ship Modal ---
interface BulkShipResult {
  orderId: string;
  orderNo: string;
  trackingNumber?: string;
  labelUrl?: string;
  error?: string;
}

function BulkShipModal({
  isOpen,
  onClose,
  selectedOrders,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: OrderWithRelations[];
  onSuccess: () => void;
}) {
  const [weight, setWeight] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BulkShipResult[] | null>(null);

  if (!isOpen) return null;

  const confirmedOrders = selectedOrders.filter((o) => o.status === 'CONFIRMED');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/shipping/trans-express/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: confirmedOrders.map((o) => o.id),
          weight: parseFloat(weight) || 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create bulk shipments');
        return;
      }

      setResults(data.results);
      const succeeded = data.results.filter((r: BulkShipResult) => r.trackingNumber).length;
      const failed = data.results.filter((r: BulkShipResult) => r.error).length;
      if (succeeded > 0) toast.success(`${succeeded} order${succeeded > 1 ? 's' : ''} shipped${failed > 0 ? `, ${failed} failed` : ''}`);
      if (failed > 0 && succeeded === 0) toast.error(`All ${failed} shipments failed`);
      if (succeeded > 0) onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-xl ring-1 ring-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bulk Ship via Trans Express</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {confirmedOrders.length} confirmed order{confirmedOrders.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Results view */}
          {results ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Shipment Results</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.map((r) => {
                      const order = confirmedOrders.find((o) => o.id === r.orderId);
                      return (
                        <tr key={r.orderId} className={r.trackingNumber ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'bg-red-50/30 dark:bg-red-900/10'}>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            #{order?.number || r.orderId.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{order?.customerName}</td>
                          <td className="px-4 py-2.5">
                            {r.trackingNumber ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                                {r.trackingNumber}
                              </span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 text-xs">{r.error}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Order preview */}
              <div className="rounded-xl border border-border overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">City</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">COD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {confirmedOrders.map((o) => (
                      <tr key={o.id} className="bg-card">
                        <td className="px-4 py-2.5 font-medium text-foreground">#{o.number || o.id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.customerName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {(() => {
                            const city = o.customerCity || (o.lead?.csvData as any)?.city || '';
                            if (city) return city;
                            // Extract last part of address as city guess
                            const parts = o.customerAddress?.split(/[,\s]+/).map(p => p.trim()).filter(Boolean) || [];
                            return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '—');
                          })()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-foreground">
                          {o.total > 0 ? `LKR ${o.total.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Weight input */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">
                  Weight per parcel (kg)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-24 rounded-lg border border-border bg-background text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {confirmedOrders.length < selectedOrders.length && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {selectedOrders.length - confirmedOrders.length} selected order{selectedOrders.length - confirmedOrders.length > 1 ? 's are' : ' is'} not CONFIRMED and will be skipped.
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || confirmedOrders.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Shipping...' : `Ship ${confirmedOrders.length} Order${confirmedOrders.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---
export function OrdersClient({ initialOrders, user, tenantConfig }: OrdersClientProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isBulkShipModalOpen, setIsBulkShipModalOpen] = useState(false);

  const displayedOrders = activeCategory === 'ALL'
    ? orders
    : orders.filter(order =>
        CATEGORY_CONFIG[activeCategory as keyof typeof CATEGORY_CONFIG]?.statuses?.includes(order.status)
      );

  const countByCategory = {
    ALL: orders.length,
    PENDING: orders.filter(o => ['PENDING', 'CONFIRMED'].includes(o.status)).length,
    SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
    DELIVERED: orders.filter(o => ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(o.status)).length,
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const allDisplayedSelected = displayedOrders.length > 0 && displayedOrders.every(o => selectedOrders.includes(o.id));

  const handleSelectAll = () => {
    const ids = displayedOrders.map(o => o.id);
    if (allDisplayedSelected) {
      setSelectedOrders(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedOrders(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const selectedOrderObjects = orders.filter(o => selectedOrders.includes(o.id));
  const selectedConfirmedCount = selectedOrderObjects.filter(o => o.status === 'CONFIRMED').length;

  const canPrintInvoices = user.role === 'ADMIN' || user.permissions?.includes('CREATE_ORDERS') || user.permissions?.includes('EDIT_ORDERS');
  const canShip = user.role === 'ADMIN' || user.permissions?.includes('UPDATE_SHIPPING_STATUS');

  const handleBulkShipSuccess = () => {
    // Mark shipped orders as SHIPPED in local state to reflect immediately
    setOrders(prev =>
      prev.map(o =>
        selectedOrders.includes(o.id) && o.status === 'CONFIRMED'
          ? { ...o, status: 'SHIPPED' as any }
          : o
      )
    );
    setSelectedOrders([]);
    setIsBulkShipModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          {user.role === 'ADMIN' && <SyncOrdersButton />}

          {/* Bulk Ship button — shown when Trans Express configured and CONFIRMED orders selected */}
          {tenantConfig?.hasTransExpress && canShip && selectedConfirmedCount > 0 && (
            <button
              onClick={() => setIsBulkShipModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
            >
              <TruckIcon className="h-4 w-4" />
              Bulk Ship ({selectedConfirmedCount})
            </button>
          )}
        </div>

        {canPrintInvoices && (
          <Link
            href={selectedOrders.length > 0 ? `/orders/print?ids=${selectedOrders.join(',')}` : '#'}
            aria-disabled={selectedOrders.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm ${selectedOrders.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md'
              }`}
            onClick={(e) => { if (selectedOrders.length === 0) e.preventDefault(); }}
          >
            <PrinterIcon className="h-4 w-4" />
            Print Selected ({selectedOrders.length})
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORY_CONFIG).map(([cat, catConfig]) => {
          const count = countByCategory[cat as keyof typeof countByCategory];
          const isActive = activeCategory === cat;
          const statusKey = cat !== 'ALL' ? cat : null;
          const Icon = statusKey ? STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG]?.icon : null;
          const filterActiveClass = statusKey ? STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG]?.filterActive : '';

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive
                ? (cat === 'ALL' ? 'bg-foreground text-background' : filterActiveClass)
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {catConfig.label}
              <span className="ml-0.5 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <TruckIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No orders found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      checked={allDisplayedSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No orders in this category
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                    return (
                      <tr
                        key={order.id}
                        className={`${config?.rowColor ?? ''} hover:brightness-95 dark:hover:brightness-110 transition-all`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => handleSelectOrder(order.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-bold text-foreground hover:text-primary transition-colors"
                          >
                            #{order.number || order.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                          {order.customerName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[160px] truncate">
                          {order.product.name}
                        </td>
                        <td className="px-4 py-3">
                          {config && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${config.color}`}>
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-foreground hidden sm:table-cell whitespace-nowrap">
                          {order.total > 0 ? `LKR ${order.total.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <OrderActions order={order} user={user} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BulkShipModal
        isOpen={isBulkShipModalOpen}
        onClose={() => setIsBulkShipModalOpen(false)}
        selectedOrders={selectedOrderObjects}
        onSuccess={handleBulkShipSuccess}
      />
    </div>
  );
}
