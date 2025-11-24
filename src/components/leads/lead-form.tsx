'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  CubeIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Product {
  id: string;
  name: string;
  code: string;
  price: number;
  stock: number;
  lowStockAlert: number;
}

interface LeadFormProps {
  products: Product[];
  onSubmit?: () => Promise<void>;
  onCancel?: () => void;
}

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  secondPhone: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  productCode: z.string().min(1, 'Product is required'),
  notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+94') && cleaned.length === 12) {
    return '0' + cleaned.substring(3);
  }
  if (cleaned.startsWith('94') && cleaned.length === 11) {
    return '0' + cleaned.substring(2);
  }
  if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  return cleaned.replace('+', '');
}

const getStockStatusColor = (product: Product): string => {
  if (product.stock <= 0) {
    return 'text-destructive';
  }
  if (product.stock <= product.lowStockAlert) {
    return 'text-orange-500';
  }
  return 'text-green-500';
};

const LowStockModal = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl ring-1 ring-border"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Stock Warning</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Proceed Anyway'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export function LeadForm({ products, onSubmit, onCancel }: LeadFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LeadFormData>({
    name: '',
    phone: '',
    secondPhone: '',
    address: '',
    productCode: '',
    notes: '',
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent, forceCreate: boolean = false) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const validatedData = leadSchema.parse(formData);

      const normalizedPhone = normalizePhoneNumber(validatedData.phone);
      const normalizedSecondPhone = validatedData.secondPhone
        ? normalizePhoneNumber(validatedData.secondPhone)
        : '';

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: {
            name: validatedData.name,
            phone: normalizedPhone,
            secondPhone: normalizedSecondPhone,
            address: validatedData.address,
            notes: validatedData.notes,
            city: "",
            source: "",
          },
          productCode: validatedData.productCode,
          forceCreate: forceCreate,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create lead');
      }

      if (result.requiresConfirmation) {
        setModalMessage(result.message);
        setIsModalOpen(true);
        setIsLoading(false);
        return;
      }

      await onSubmit?.();
      router.push('/leads');
      router.refresh();

    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      setIsLoading(false);
    }
  };

  const handleForceCreate = () => {
    setIsModalOpen(false);
    handleSubmit({ preventDefault: () => { } } as React.FormEvent, true);
  };

  return (
    <>
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                placeholder="0771234567"
                required
              />
            </div>
          </div>

          {/* Second Phone Field */}
          <div>
            <label htmlFor="secondPhone" className="block text-sm font-medium text-muted-foreground mb-2">Second Phone (Optional)</label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                id="secondPhone"
                value={formData.secondPhone || ''}
                onChange={(e) => setFormData({ ...formData, secondPhone: e.target.value })}
                className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                placeholder="0712345678"
              />
            </div>
          </div>

          {/* Product Field */}
          <div>
            <label htmlFor="product" className="block text-sm font-medium text-muted-foreground mb-2">Product</label>
            <div className="relative">
              <CubeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                id="product"
                value={formData.productCode}
                onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5 appearance-none"
                required
              >
                <option value="">Select a product</option>
                {products.map((product) => (
                  <option key={product.code} value={product.code} className={getStockStatusColor(product)}>
                    {product.name} (Stock: {product.stock})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Address Field */}
          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-muted-foreground mb-2">Address</label>
            <div className="relative">
              <MapPinIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                placeholder="123 Main St, City"
                required
              />
            </div>
          </div>

          {/* Notes Field */}
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground mb-2">Notes (Optional)</label>
            <div className="relative">
              <DocumentTextIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5 resize-none"
                placeholder="Any additional information..."
              />
            </div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2"
          >
            <ExclamationTriangleIcon className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border">
          <motion.button
            type="button"
            onClick={onCancel || (() => router.back())}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cancel
          </motion.button>
          <motion.button
            type="submit"
            disabled={isLoading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : ('Create Lead')}
          </motion.button>
        </div>
      </form>

      <AnimatePresence>
        {isModalOpen && (
          <LowStockModal
            isOpen={isModalOpen}
            message={modalMessage}
            onConfirm={handleForceCreate}
            onCancel={() => setIsModalOpen(false)}
            isLoading={isLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
}
