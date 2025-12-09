'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  XCircleIcon,
  ArrowLeftIcon,
  ShoppingBagIcon
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
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    label: 'Pending Verification',
  },
  CONFIRMED: {
    icon: CheckCircleIcon,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    label: 'Confirmed',
  },
  REJECTED: {
    icon: XCircleIcon,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    label: 'Rejected',
  },
};

export function PurchasesClient({ initialPurchases }: PurchasesClientProps) {
  const [purchases] = useState<Purchase[]>(initialPurchases);
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link href="/store" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Purchases</h1>
          <p className="text-sm text-muted-foreground">Track your purchase orders</p>
        </div>
      </div>

      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-2xl bg-green-500/10 border border-green-500/20 p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-green-500">Order Placed Successfully!</p>
              <p className="text-sm text-muted-foreground">
                Your order is pending verification. We&apos;ll notify you once confirmed.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-3xl border border-dashed border-border">
          <div className="p-4 rounded-full bg-muted mb-4">
            <ShoppingBagIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No purchases yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your purchase history will appear here.
          </p>
          <Link
            href="/store"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Browse Store
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => {
            const config = statusConfig[purchase.status];
            const StatusIcon = config.icon;

            return (
              <motion.div
                key={purchase.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Order #{purchase.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(purchase.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${config.color}`} />
                      <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {purchase.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.storeProduct.name} × {item.quantity}
                        </span>
                        <span className="font-medium">
                          LKR {(item.quantity * item.priceAtPurchase).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <div className="text-sm text-muted-foreground">
                      <p>Receipt: {purchase.bankReceiptNumber}</p>
                      <p>WhatsApp: {purchase.whatsappNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">LKR {purchase.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>

                  {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                    <div className="mt-4 p-3 rounded-xl bg-red-500/10 text-sm">
                      <p className="font-medium text-red-500">Rejection Reason:</p>
                      <p className="text-muted-foreground">{purchase.rejectionReason}</p>
                    </div>
                  )}

                  {purchase.status === 'CONFIRMED' && purchase.confirmedAt && (
                    <div className="mt-4 p-3 rounded-xl bg-green-500/10 text-sm">
                      <p className="text-green-500">
                        ✓ Confirmed on {new Date(purchase.confirmedAt).toLocaleDateString()}
                        {' '}- Stock added to your inventory
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
