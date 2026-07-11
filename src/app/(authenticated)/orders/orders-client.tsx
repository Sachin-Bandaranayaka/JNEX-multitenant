// src/app/(authenticated)/orders/orders-client.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OrderActions } from '@/components/orders/order-actions';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
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
    rowColor: 'bg-amber-100 dark:bg-amber-900/30',
    badgeColor: 'bg-yellow-600 text-white',
    dotColor: 'bg-yellow-400',
    filterActive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ring-1 ring-yellow-400/50',
    icon: ClockIcon
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20',
    rowColor: 'bg-blue-100 dark:bg-blue-900/30',
    badgeColor: 'bg-blue-600 text-white',
    dotColor: 'bg-blue-500',
    filterActive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-400/50',
    icon: CheckCircleIcon
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-500/20',
    rowColor: 'bg-purple-100 dark:bg-purple-900/30',
    badgeColor: 'bg-purple-600 text-white',
    dotColor: 'bg-purple-500',
    filterActive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-1 ring-purple-400/50',
    icon: TruckIcon
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/20',
    rowColor: 'bg-green-100 dark:bg-green-900/30',
    badgeColor: 'bg-green-600 text-white',
    dotColor: 'bg-green-500',
    filterActive: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-400/50',
    icon: CheckCircleIcon
  },
  RETURNED: {
    label: 'Returned',
    color: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
    rowColor: 'bg-red-100 dark:bg-red-900/30',
    badgeColor: 'bg-red-600 text-white',
    dotColor: 'bg-red-500',
    filterActive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-400/50',
    icon: ArrowPathIcon
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20',
    rowColor: 'bg-gray-100 dark:bg-gray-800/50',
    badgeColor: 'bg-gray-600 text-white',
    dotColor: 'bg-gray-400',
    filterActive: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 ring-1 ring-gray-400/50',
    icon: XCircleIcon
  },
  RESCHEDULED: {
    label: 'Rescheduled',
    color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/20',
    rowColor: 'bg-orange-100 dark:bg-orange-900/30',
    badgeColor: 'bg-orange-600 text-white',
    dotColor: 'bg-orange-400',
    filterActive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-400/50',
    icon: ArrowPathIcon
  },
};

// Category groups for the filter tabs
const CATEGORY_CONFIG = {
  ALL: { label: 'All', statuses: null },
  PENDING: { label: 'Pending', statuses: ['PENDING'] },
  CONFIRMED: { label: 'Confirmed', statuses: ['CONFIRMED'] },
  RESCHEDULED: { label: 'Rescheduled', statuses: ['RESCHEDULED'] },
};

// --- Bulk Ship Modal ---
interface BulkShipResult {
  orderId: string;
  orderNo: string;
  trackingNumber?: string;
  labelUrl?: string;
  error?: string;
}

interface OrderMapping {
  provinceId?: number;
  districtId?: number;
  cityId?: number;
  weight: string;
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
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [weight, setWeight] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BulkShipResult[] | null>(null);

  // Manual mode states
  const [provinces, setProvinces] = useState<any[]>([]);
  const [allCities, setAllCities] = useState<any[]>([]);
  const [districtsCache, setDistrictsCache] = useState<Record<number, any[]>>({});
  const [citiesCache, setCitiesCache] = useState<Record<number, any[]>>({});
  const [mappings, setMappings] = useState<Record<string, OrderMapping>>({});
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const confirmedOrders = selectedOrders.filter((o) => o.status === 'CONFIRMED');

  // Load locations for manual mode
  useEffect(() => {
    if (mode !== 'manual' || provinces.length > 0 || !isOpen) return;

    const loadLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const response = await fetch('/api/shipping/locations');
        if (!response.ok) throw new Error('Failed to fetch locations');
        const data = await response.json();
        setProvinces(data.provinces || []);
        setAllCities(data.cities || []);
      } catch (e) {
        toast.error('Failed to load locations from Trans Express');
      } finally {
        setIsLoadingLocations(false);
      }
    };

    loadLocations();
  }, [mode, provinces.length, isOpen]);

  // Guess cities if locations are loaded
  useEffect(() => {
    if (allCities.length === 0 || confirmedOrders.length === 0) return;

    const initialMappings: Record<string, OrderMapping> = {};
    confirmedOrders.forEach((o) => {
      const cityName = o.customerCity || (o.lead?.csvData as any)?.city || '';
      const match = allCities.find(
        (c) => c.text.toLowerCase().trim() === cityName.toLowerCase().trim()
      );

      if (match) {
        initialMappings[o.id] = {
          cityId: match.id,
          districtId: match.district_id,
          weight: '1',
        };
      } else {
        initialMappings[o.id] = {
          weight: '1',
        };
      }
    });

    setMappings((prev) => ({ ...initialMappings, ...prev }));
  }, [allCities, confirmedOrders]);

  if (!isOpen) return null;

  const handleProvinceChange = async (orderId: string, provinceId: number) => {
    setMappings((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        provinceId,
        districtId: undefined,
        cityId: undefined,
      },
    }));

    if (!districtsCache[provinceId]) {
      try {
        const response = await fetch(`/api/shipping/locations/districts?province_id=${provinceId}`);
        if (response.ok) {
          const data = await response.json();
          setDistrictsCache((prev) => ({
            ...prev,
            [provinceId]: data.districts || [],
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDistrictChange = async (orderId: string, districtId: number) => {
    setMappings((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        districtId,
        cityId: undefined,
      },
    }));

    if (!citiesCache[districtId]) {
      try {
        const response = await fetch(`/api/shipping/locations/cities?district_id=${districtId}`);
        if (response.ok) {
          const data = await response.json();
          setCitiesCache((prev) => ({
            ...prev,
            [districtId]: data.cities || [],
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCityChange = (orderId: string, cityId: number) => {
    setMappings((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        cityId,
      },
    }));
  };

  const handleWeightChange = (orderId: string, weight: string) => {
    setMappings((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        weight,
      },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let bodyData;

      if (mode === 'manual') {
        const payload = confirmedOrders.map((o) => {
          const m = mappings[o.id];
          return {
            orderId: o.id,
            cityId: m?.cityId || 864, // Fallback to Colombo 1 if missing
            weight: parseFloat(m?.weight || weight) || 1,
          };
        });
        bodyData = { orders: payload };
      } else {
        bodyData = {
          orderIds: confirmedOrders.map((o) => o.id),
          weight: parseFloat(weight) || 1,
        };
      }

      const response = await fetch('/api/shipping/trans-express/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create bulk shipments');
        return;
      }

      setResults(data.results);
      const succeeded = data.results.filter((r: BulkShipResult) => r.trackingNumber).length;
      const failed = data.results.filter((r: BulkShipResult) => r.error).length;
      if (succeeded > 0)
        toast.success(
          `${succeeded} order${succeeded > 1 ? 's' : ''} shipped${
            failed > 0 ? `, ${failed} failed` : ''
          }`
        );
      if (failed > 0 && succeeded === 0) toast.error(`All ${failed} shipments failed`);
      if (succeeded > 0) onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isManualReady = confirmedOrders.every((o) => mappings[o.id]?.cityId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-card shadow-xl ring-1 ring-border overflow-hidden">
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
              {/* Mode Selector Tabs */}
              <div className="flex border-b border-border mb-4">
                <button
                  type="button"
                  onClick={() => setMode('auto')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    mode === 'auto'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Auto (Auto-resolve Cities)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    mode === 'manual'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manual (Select Locations)
                </button>
              </div>

              {mode === 'manual' && isLoadingLocations ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-2 text-foreground">
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm">Loading Trans Express locations...</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 border-b border-border z-10">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Customer</th>
                        {mode === 'auto' ? (
                          <>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">City</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">COD</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Address</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Province</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">District</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">City</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Weight</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {confirmedOrders.map((o) => {
                        if (mode === 'auto') {
                          return (
                            <tr key={o.id} className="bg-card">
                              <td className="px-4 py-2.5 font-medium text-foreground">#{o.number || o.id.slice(0, 8)}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{o.customerName}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                {(() => {
                                  const city = o.customerCity || (o.lead?.csvData as any)?.city || '';
                                  if (city) return city;
                                  const parts = o.customerAddress?.split(/[,\s]+/).map(p => p.trim()).filter(Boolean) || [];
                                  return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '—');
                                })()}
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs font-medium text-foreground">
                                {o.total > 0 ? `LKR ${o.total.toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          );
                        } else {
                          const mapping = mappings[o.id] || { weight: '1' };
                          const districts = mapping.provinceId ? (districtsCache[mapping.provinceId] || []) : [];
                          const cities = mapping.districtId ? (citiesCache[mapping.districtId] || []) : [];

                          return (
                            <tr key={o.id} className="bg-card">
                              <td className="px-4 py-2.5 font-medium text-foreground">#{o.number || o.id.slice(0, 8)}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                                <div className="font-medium text-foreground">{o.customerName}</div>
                                <div>{o.customerPhone}</div>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[120px] truncate" title={o.customerAddress}>
                                {o.customerAddress}
                              </td>
                              <td className="px-2 py-2.5">
                                <select
                                  value={mapping.provinceId || ''}
                                  onChange={(e) => handleProvinceChange(o.id, Number(e.target.value))}
                                  className="text-xs p-1 rounded border border-border bg-background text-foreground w-full max-w-[130px]"
                                >
                                  <option value="">Select Province</option>
                                  {provinces.map(p => (
                                    <option key={p.id} value={p.id}>{p.name || p.text}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-2.5">
                                <select
                                  value={mapping.districtId || ''}
                                  onChange={(e) => handleDistrictChange(o.id, Number(e.target.value))}
                                  disabled={!mapping.provinceId}
                                  className="text-xs p-1 rounded border border-border bg-background text-foreground w-full max-w-[130px] disabled:opacity-50"
                                >
                                  <option value="">Select District</option>
                                  {districts.map(d => (
                                    <option key={d.id} value={d.id}>{d.text}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-2.5">
                                <select
                                  value={mapping.cityId || ''}
                                  onChange={(e) => handleCityChange(o.id, Number(e.target.value))}
                                  disabled={!mapping.districtId}
                                  className="text-xs p-1 rounded border border-border bg-background text-foreground w-full max-w-[130px] disabled:opacity-50"
                                >
                                  <option value="">Select City</option>
                                  {cities.map(c => (
                                    <option key={c.id} value={c.id}>{c.text}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-2.5">
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={mapping.weight}
                                  onChange={(e) => handleWeightChange(o.id, e.target.value)}
                                  className="w-16 rounded border border-border bg-background text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </td>
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Weight input for Auto mode */}
              {mode === 'auto' && (
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
              )}

              {confirmedOrders.length < selectedOrders.length && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {selectedOrders.length - confirmedOrders.length} selected order{selectedOrders.length - confirmedOrders.length > 1 ? 's are' : ' is'} not CONFIRMED and will be skipped.
                </p>
              )}

              {mode === 'manual' && !isManualReady && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Please select Province, District, and City for all orders before shipping.
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
                  disabled={isSubmitting || confirmedOrders.length === 0 || (mode === 'manual' && !isManualReady)}
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
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const requestedStatus = searchParams.get('status')?.toUpperCase();
  const [activeCategory, setActiveCategory] = useState<string>(requestedStatus && requestedStatus in CATEGORY_CONFIG ? requestedStatus : 'ALL');
  const [isBulkShipModalOpen, setIsBulkShipModalOpen] = useState(false);

  const displayedOrders = activeCategory === 'ALL'
    ? orders
    : orders.filter(order =>
        CATEGORY_CONFIG[activeCategory as keyof typeof CATEGORY_CONFIG]?.statuses?.includes(order.status)
      );

  const countByCategory = {
    ALL: orders.length,
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    RESCHEDULED: orders.filter(o => o.status === 'RESCHEDULED').length,
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

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {Object.entries(STATUS_CONFIG)
          .filter(([key]) => ['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(key))
          .map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${cfg.dotColor}`} />
              <span className="text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
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
            <table className="w-full text-xs border-collapse border border-slate-200 no-genzo-override">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-white">
                  <th className="px-2 py-2 w-8 border-r border-b border-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      checked={allDisplayedSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left px-2 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200">Order #</th>
                  <th className="text-left px-2 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200">Customer</th>
                  <th className="text-left px-2 py-2 font-bold text-slate-600 text-[13px] hidden md:table-cell border-r border-b border-slate-200">Product</th>
                  <th className="text-left px-2 py-2 font-bold text-slate-600 text-[13px] hidden lg:table-cell border-r border-b border-slate-200">Tracking No</th>
                  <th className="text-left px-2 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200">Status</th>
                  <th className="text-left px-2 py-2 font-bold text-slate-600 text-[13px] hidden sm:table-cell border-r border-b border-slate-200">Date</th>
                  <th className="text-right px-2 py-2 font-bold text-slate-600 text-[13px] hidden sm:table-cell border-r border-b border-slate-200">Total</th>
                  <th className="text-right px-2 py-2 font-bold text-slate-600 text-[13px] border-b border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm border-b border-slate-200">
                      No orders in this category
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                    return (
                      <tr
                        key={order.id}
                        className="odd:bg-[#f9fafb] even:bg-white hover:brightness-[0.98] transition-all"
                      >
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => handleSelectOrder(order.id)}
                          />
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle">
                          <Link href={`/orders/${order.id}`}>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${config?.badgeColor ?? 'bg-gray-500 text-white'}`}>
                              {order.number || order.id.slice(0, 8)}
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle font-medium text-foreground max-w-[140px] truncate">
                          {order.customerName}
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle text-muted-foreground hidden md:table-cell max-w-[160px] truncate text-xs">
                          {order.product.name}
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle hidden lg:table-cell">
                          {order.trackingNumber ? (
                            <span className="text-xs text-primary font-medium">{order.trackingNumber}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-2 py-2.5 border-r border-b border-slate-200 align-middle text-right text-xs font-semibold text-foreground hidden sm:table-cell whitespace-nowrap">
                          {order.total > 0 ? `LKR ${order.total.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-right border-b border-slate-200 align-middle">
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
