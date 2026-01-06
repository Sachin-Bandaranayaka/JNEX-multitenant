'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  XCircleIcon,
  ArrowLeftIcon,
  ShoppingBagIcon,
  ReceiptRefundIcon,
  PhoneIcon,
  CalendarIcon,
  ChevronDownIcon,
  SparklesIcon
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
  items: PurchaseItem[];
}

interface PurchasesClientProps {
  initialPurchases: Purchase[];
}

const statusConfig = {
  PENDING: {
    icon: ClockIcon,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    label: 'Pending Verification',
    description: 'Your payment is being verified',
  },
  CONFIRMED: {
    icon: CheckCircleIcon,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'Confirmed',
    description: 'Order confirmed and processed',
  },
  REJECTED: {
    icon: XCircleIcon,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    label: 'Rejected',
    description: 'Payment verification failed',
  },
};

export function PurchasesClient({ initialPurchases }: PurchasesClientProps) {
  const [purchases] = useState<Purchase[]>(initialPurchases);
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'CONFIRMED' | 'REJECTED'>('all');

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const filteredPurchases = purchases.filter(p => filter === 'all' || p.status === filter);

  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => p.status === 'PENDING').length,
    confirmed: purchases.filter(p => p.status === 'CONFIRMED').length,
    rejected: purchases.filter(p => p.status === 'REJECTED').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/store" 
              className="p-2.5 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Purchases</h1>
              <p className="text-sm text-muted-foreground">Track and manage your orders</p>
            </div>
          </div>
          <Link
            href="/store"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25"
          >
            <ShoppingBagIcon className="h-4 w-4" />
            Continue Shopping
          </Link>
        </div>

        {/* Success Banner */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-5">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-green-500/20">
                    <SparklesIcon className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-500 text-lg">Order Placed Successfully!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your order is pending verification. We&apos;ll notify you via WhatsApp once your payment is confirmed.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSuccess(false)}
                    className="p-1 rounded-full hover:bg-green-500/20 transition-colors"
                  >
                    <XCircleIcon className="h-5 w-5 text-green-500" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        {purchases.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Orders', value: stats.total, color: 'text-foreground', bg: 'bg-muted/50' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { label: 'Confirmed', value: stats.confirmed, color: 'text-green-500', bg: 'bg-green-500/10' },
              { label: 'Rejected', value: stats.rejected, color: 'text-red-500', bg: 'bg-red-500/10' },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl ${stat.bg} p-4 text-center`}
              >
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        {purchases.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: 'all', label: 'All Orders' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'REJECTED', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as typeof filter)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  filter === tab.value
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {purchases.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="p-6 rounded-full bg-muted/50 mb-6">
              <ReceiptRefundIcon className="h-16 w-16 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">No purchases yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md">
              Your purchase history will appear here once you place your first order.
            </p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
            >
              <ShoppingBagIcon className="h-5 w-5" />
              Start Shopping
            </Link>
          </motion.div>
        ) : filteredPurchases.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground">No {filter.toLowerCase()} orders found.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredPurchases.map((purchase, index) => {
                const config = statusConfig[purchase.status];
                const StatusIcon = config.icon;
                const isExpanded = expandedPurchase === purchase.id;

                return (
                  <motion.div
                    key={purchase.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-2xl bg-card border ${config.border} overflow-hidden transition-all duration-300 hover:shadow-lg`}
                  >
                    {/* Header - Always Visible */}
                    <button
                      onClick={() => setExpandedPurchase(isExpanded ? null : purchase.id)}
                      className="w-full p-5 text-left"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${config.bg}`}>
                            <StatusIcon className={`h-6 w-6 ${config.color}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">
                                Order #{purchase.id.slice(-8).toUpperCase()}
                              </p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {new Date(purchase.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">{purchase.items.length} items</p>
                            <p className="text-xl font-bold text-foreground">
                              LKR {purchase.totalAmount.toLocaleString()}
                            </p>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 space-y-4">
                            {/* Items List */}
                            <div className="rounded-xl bg-muted/30 p-4 space-y-3">
                              <p className="text-sm font-medium text-foreground mb-3">Order Items</p>
                              {purchase.items.map((item) => (
                                <div key={item.id} className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-foreground">{item.storeProduct.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      SKU: {item.storeProduct.sku} • Qty: {item.quantity}
                                    </p>
                                  </div>
                                  <p className="font-semibold text-foreground">
                                    LKR {(item.quantity * item.priceAtPurchase).toLocaleString()}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Payment Details */}
                            <div className="grid sm:grid-cols-3 gap-3">
                              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                <ReceiptRefundIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Receipt #</p>
                                  <p className="font-medium text-foreground">{purchase.bankReceiptNumber}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                <PhoneIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                                  <p className="font-medium text-foreground">{purchase.whatsappNumber}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Transfer Time</p>
                                  <p className="font-medium text-foreground">
                                    {new Date(purchase.transferTime).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Status Messages */}
                            {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                <p className="font-medium text-red-500 mb-1">Rejection Reason</p>
                                <p className="text-sm text-muted-foreground">{purchase.rejectionReason}</p>
                              </div>
                            )}

                            {purchase.status === 'CONFIRMED' && purchase.confirmedAt && (
                              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <div className="flex items-center gap-2">
                                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                  <p className="font-medium text-green-500">
                                    Confirmed on {new Date(purchase.confirmedAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })}
                                  </p>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Stock has been added to your inventory.
                                </p>
                              </div>
                            )}

                            {purchase.status === 'PENDING' && (
                              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <div className="flex items-center gap-2">
                                  <ClockIcon className="h-5 w-5 text-amber-500" />
                                  <p className="font-medium text-amber-500">Awaiting Verification</p>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Your payment is being verified. You&apos;ll receive a WhatsApp notification once confirmed.
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
