'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { EmptyState, PageHeader, saBtnDanger, saBtnGhost, saBtnSuccess, saCard, saInput, saLabel, tenantLabel } from '../../ui';

interface PurchaseItem {
  id: string;
  quantity: number;
  priceAtPurchase: number;
  storeProduct: {
    name: string;
    sku: string;
  };
}

interface Purchase {
  id: string;
  bankReceiptNumber: string;
  whatsappNumber: string;
  transferTime: string | Date;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  rejectionReason: string | null;
  confirmedAt: string | Date | null;
  createdAt: string | Date;
  user: { id: string; name: string | null; email: string };
  tenant: { id: string; name: string; businessName: string | null };
  items: PurchaseItem[];
}

interface PurchasesManagementClientProps {
  initialPurchases: Purchase[];
}

type FilterStatus = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED';

export function PurchasesManagementClient({ initialPurchases }: PurchasesManagementClientProps) {
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const filteredPurchases = filter === 'ALL' 
    ? purchases 
    : purchases.filter(p => p.status === filter);

  const handleConfirm = async (purchaseId: string) => {
    if (!confirm('Confirm this purchase? Stock will be added to the tenant\'s inventory.')) return;

    setProcessing(purchaseId);
    try {
      const response = await fetch(`/api/store/purchases/${purchaseId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm purchase');
      }

      const updatedPurchase = await response.json();
      setPurchases(prev => prev.map(p => p.id === purchaseId ? updatedPurchase : p));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to confirm purchase');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedPurchase) return;

    setProcessing(selectedPurchase.id);
    try {
      const response = await fetch(`/api/store/purchases/${selectedPurchase.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject',
          rejectionReason: rejectionReason || 'Payment not verified',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject purchase');
      }

      const updatedPurchase = await response.json();
      setPurchases(prev => prev.map(p => p.id === selectedPurchase.id ? updatedPurchase : p));
      setShowRejectModal(false);
      setSelectedPurchase(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject purchase');
    } finally {
      setProcessing(null);
    }
  };

  const statusConfig = {
    PENDING: { icon: ClockIcon, color: 'text-amber-800', bg: 'bg-amber-50' },
    CONFIRMED: { icon: CheckCircleIcon, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    REJECTED: { icon: XCircleIcon, color: 'text-red-700', bg: 'bg-red-50' },
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform store"
        title="Purchase orders"
        description="Review and manage tenant purchase requests."
        backHref="/superadmin/store"
        backLabel="Back to store"
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-bold transition-colors ${
              filter === status
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-50'
            }`}
          >
            {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            {status === 'PENDING' && (
              <span className="ml-2 rounded-full bg-[#e10600] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {purchases.filter(p => p.status === 'PENDING').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredPurchases.length === 0 ? (
        <div className={saCard}>
          <EmptyState title="No purchases found" description="Purchase requests matching this filter will appear here." />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPurchases.map((purchase) => {
            const config = statusConfig[purchase.status];
            const StatusIcon = config.icon;

            return (
              <motion.div
                key={purchase.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${saCard} overflow-hidden`}
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-slate-500">
                          #{purchase.id.slice(-8).toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${config.bg} ${config.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {purchase.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tenant</p>
                          <p className="font-bold text-slate-900">
                            {tenantLabel(purchase.tenant)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">User</p>
                          <p className="text-sm text-slate-700">{purchase.user.name || purchase.user.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Receipt Number</p>
                          <p className="text-white font-mono">{purchase.bankReceiptNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">WhatsApp</p>
                          <a 
                            href={`https://wa.me/${purchase.whatsappNumber.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-bold text-[#c50500] hover:underline"
                          >
                            {purchase.whatsappNumber}
                          </a>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Transfer Time</p>
                          <p className="text-sm text-slate-700">
                            {new Date(purchase.transferTime).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Order Date</p>
                          <p className="text-sm text-slate-700">
                            {new Date(purchase.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Items</p>
                        <div className="space-y-1">
                          {purchase.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-slate-600">
                                {item.storeProduct.name} × {item.quantity}
                              </span>
                              <span className="font-semibold tabular-nums text-slate-900">
                                LKR {(item.quantity * item.priceAtPurchase).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total amount</p>
                        <p className="text-2xl font-bold tabular-nums text-slate-900">
                          LKR {purchase.totalAmount.toLocaleString()}
                        </p>
                      </div>

                      {purchase.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirm(purchase.id)}
                            disabled={processing === purchase.id}
                            className={saBtnSuccess}
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Confirm
                          </button>
                          <button
                            onClick={() => openRejectModal(purchase)}
                            disabled={processing === purchase.id}
                            className={saBtnDanger}
                          >
                            <XCircleIcon className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Rejection reason</p>
                          <p className="text-sm font-semibold text-red-700">{purchase.rejectionReason}</p>
                        </div>
                      )}

                      {purchase.status === 'CONFIRMED' && purchase.confirmedAt && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Confirmed at</p>
                          <p className="text-sm font-semibold text-emerald-700">
                            {new Date(purchase.confirmedAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-2xl"
            >
              <h3 className="font-bold text-slate-900">Reject purchase</h3>
              <p className="mb-4 mt-2 text-sm text-slate-600">
                Are you sure you want to reject this purchase from{' '}
                <span className="font-bold text-slate-900">{tenantLabel(selectedPurchase.tenant)}</span>?
              </p>
              <div className="mb-4">
                <label htmlFor="rejectionReason" className={`${saLabel} mb-1.5`}>
                  Rejection reason (optional)
                </label>
                <textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className={saInput}
                  placeholder="Enter reason for rejection…"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className={saBtnGhost}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing === selectedPurchase.id}
                  className={saBtnDanger}
                >
                  {processing === selectedPurchase.id ? 'Rejecting…' : 'Reject purchase'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
