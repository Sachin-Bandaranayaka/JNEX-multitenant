'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ArrowLeftIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

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
    PENDING: { icon: ClockIcon, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    CONFIRMED: { icon: CheckCircleIcon, color: 'text-green-400', bg: 'bg-green-500/10' },
    REJECTED: { icon: XCircleIcon, color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/superadmin/store" className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
          <p className="text-sm text-gray-400">Review and manage purchase requests</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            {status === 'PENDING' && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-yellow-500 text-black text-xs">
                {purchases.filter(p => p.status === 'PENDING').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredPurchases.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No purchases found.
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
                className="rounded-xl bg-gray-800/80 ring-1 ring-white/10 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-gray-400">
                          #{purchase.id.slice(-8).toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {purchase.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Tenant</p>
                          <p className="text-white font-medium">
                            {purchase.tenant.businessName || purchase.tenant.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">User</p>
                          <p className="text-white">{purchase.user.name || purchase.user.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Receipt Number</p>
                          <p className="text-white font-mono">{purchase.bankReceiptNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">WhatsApp</p>
                          <a 
                            href={`https://wa.me/${purchase.whatsappNumber.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline"
                          >
                            {purchase.whatsappNumber}
                          </a>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Transfer Time</p>
                          <p className="text-white">
                            {new Date(purchase.transferTime).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Order Date</p>
                          <p className="text-white">
                            {new Date(purchase.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-gray-700 pt-4">
                        <p className="text-xs text-gray-500 uppercase mb-2">Items</p>
                        <div className="space-y-1">
                          {purchase.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-300">
                                {item.storeProduct.name} × {item.quantity}
                              </span>
                              <span className="text-white font-medium">
                                LKR {(item.quantity * item.priceAtPurchase).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total Amount</p>
                        <p className="text-2xl font-bold text-white">
                          LKR {purchase.totalAmount.toLocaleString()}
                        </p>
                      </div>

                      {purchase.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirm(purchase.id)}
                            disabled={processing === purchase.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Confirm
                          </button>
                          <button
                            onClick={() => openRejectModal(purchase)}
                            disabled={processing === purchase.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
                          >
                            <XCircleIcon className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Rejection Reason</p>
                          <p className="text-sm text-red-400">{purchase.rejectionReason}</p>
                        </div>
                      )}

                      {purchase.status === 'CONFIRMED' && purchase.confirmedAt && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Confirmed At</p>
                          <p className="text-sm text-green-400">
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl ring-1 ring-white/10 p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Reject Purchase</h3>
              <p className="text-sm text-gray-400 mb-4">
                Are you sure you want to reject this purchase from{' '}
                <span className="text-white">{selectedPurchase.tenant.businessName || selectedPurchase.tenant.name}</span>?
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Rejection Reason (optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-gray-700 border-gray-600 px-3 py-2 text-white placeholder-gray-400"
                  placeholder="Enter reason for rejection..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing === selectedPurchase.id}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {processing === selectedPurchase.id ? 'Rejecting...' : 'Reject Purchase'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
