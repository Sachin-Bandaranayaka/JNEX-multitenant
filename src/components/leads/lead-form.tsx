// src/components/leads/lead-form.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { z } from 'zod';

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

// --- UPDATED: Add secondPhone to the validation schema ---
const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  secondPhone: z.string().optional(), // New optional field
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
        return 'text-red-400';
    }
    if (product.stock <= product.lowStockAlert) {
        return 'text-orange-400';
    }
    return 'text-green-400';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
            <div className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl ring-1 ring-white/10">
                <h2 className="text-lg font-bold text-yellow-300">Low Stock Warning</h2>
                <p className="mt-2 text-sm text-gray-300">{message}</p>
                <div className="mt-6 flex justify-end space-x-4">
                    <button type="button" onClick={onCancel} disabled={isLoading} className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500 disabled:opacity-50">Cancel</button>
                    <button type="button" onClick={onConfirm} disabled={isLoading} className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? 'Creating...' : 'Proceed Anyway'}</button>
                </div>
            </div>
        </div>
    );
};

export function LeadForm({ products, onSubmit, onCancel }: LeadFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // --- UPDATED: Add secondPhone to the initial form state ---
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
      // --- NEW: Normalize the second phone number as well ---
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
            secondPhone: normalizedSecondPhone, // --- UPDATED: Pass the second phone number ---
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
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm sm:text-base font-medium text-gray-400 mb-2 leading-tight">Name</label>
            <input type="text" id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation" required />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm sm:text-base font-medium text-gray-400 mb-2 leading-tight">Phone</label>
            <input type="tel" id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation" required />
          </div>

          {/* --- NEW: Second Phone Input Field --- */}
          <div>
            <label htmlFor="secondPhone" className="block text-sm sm:text-base font-medium text-gray-400 mb-2 leading-tight">Second Phone (Optional)</label>
            <input type="tel" id="secondPhone" value={formData.secondPhone || ''} onChange={(e) => setFormData({ ...formData, secondPhone: e.target.value })} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-2">Address</label>
            <input type="text" id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation" required />
          </div>

          <div>
            <label htmlFor="product" className="block text-sm font-medium text-gray-400 mb-2">Product</label>
            <select id="product" value={formData.productCode} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation" required>
              <option value="">Select a product</option>
              {products.map((product) => (
                <option key={product.code} value={product.code} className={getStockStatusColor(product)}>
                  {product.name} - (Stock: {product.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className="block text-sm sm:text-base font-medium text-gray-400 mb-2 leading-tight">Notes (Optional)</label>
            <textarea id="notes" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm px-4 py-3 sm:py-2 touch-manipulation resize-none" />
          </div>
        </div>

        {error && (<div className="rounded-lg bg-red-900/50 p-4 text-sm text-red-400 ring-1 ring-red-500">{error}</div>)}

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
          <motion.button type="button" onClick={onCancel} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-flex items-center justify-center rounded-md border border-gray-700 px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium text-gray-400 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 touch-manipulation min-h-[44px]">Cancel</motion.button>
          <motion.button type="submit" disabled={isLoading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium text-white ring-1 ring-white/10 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation min-h-[44px]">
            {isLoading ? (<> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg> Creating... </>) : ('Create Lead')}
          </motion.button>
        </div>
      </form>

      <LowStockModal isOpen={isModalOpen} message={modalMessage} onConfirm={handleForceCreate} onCancel={() => setIsModalOpen(false)} isLoading={isLoading} />
    </>
  );
}
