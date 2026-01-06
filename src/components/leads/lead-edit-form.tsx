'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { z } from 'zod';
import {
    UserIcon,
    PhoneIcon,
    MapPinIcon,
    EnvelopeIcon,
    TagIcon,
    DocumentTextIcon,
    CubeIcon,
    HashtagIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface Product {
    id: string;
    name: string;
    code: string;
    price?: number;
}

export interface Lead {
    id: string;
    csvData: {
        name: string;
        phone: string;
        secondPhone?: string;
        email?: string | null;
        address: string;
        city: string;
        source: string;
        notes?: string;
        quantity?: number;
        discount?: number;
    };
    productCode: string;
    product: Product;
}

interface LeadEditFormProps {
    lead: Lead;
    products: Product[];
    onSuccess?: () => void;
    onCancel?: () => void;
    isModal?: boolean;
}

const leadSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().min(1, 'Phone number is required'),
    secondPhone: z.string().optional(),
    email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
    address: z.string().min(1, 'Address is required'),
    city: z.string().optional().default(""),
    source: z.string().optional().default(""),
    notes: z.string().optional(),
    productCode: z.string().min(1, 'Product is required'),
    quantity: z.number().int().positive().default(1),
    discount: z.number().min(0).default(0),
});

type LeadFormData = z.infer<typeof leadSchema>;

export function LeadEditForm({ lead, products, onSuccess, onCancel, isModal = false }: LeadEditFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<LeadFormData>({
        name: lead.csvData.name || '',
        phone: lead.csvData.phone || '',
        secondPhone: lead.csvData.secondPhone || '',
        email: lead.csvData.email || '',
        address: lead.csvData.address || '',
        city: lead.csvData.city || '',
        source: lead.csvData.source || '',
        notes: lead.csvData.notes || '',
        productCode: lead.productCode || '',
        quantity: lead.csvData.quantity || 1,
        discount: lead.csvData.discount || 0,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Validate form data
            const validatedData = leadSchema.parse(formData);

            // Send request to update lead
            const response = await fetch(`/api/leads/${lead.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    csvData: {
                        name: validatedData.name,
                        phone: validatedData.phone,
                        secondPhone: validatedData.secondPhone,
                        email: validatedData.email || null,
                        address: validatedData.address,
                        city: validatedData.city,
                        source: validatedData.source,
                        notes: validatedData.notes,
                        quantity: validatedData.quantity,
                        discount: validatedData.discount,
                    },
                    productCode: validatedData.productCode,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update lead');
            }

            // Call onSuccess callback if provided
            onSuccess?.();

            // Redirect back to leads list to show updated data
            router.push('/leads');
            router.refresh();
        } catch (err) {
            if (err instanceof z.ZodError) {
                setError(err.errors[0].message);
            } else {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Name */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-2">
                        Name
                    </label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                            required
                        />
                    </div>
                </div>

                {/* Phone */}
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-2">
                        Phone
                    </label>
                    <div className="relative">
                        <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="tel"
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                            required
                        />
                    </div>
                </div>

                {/* Second Phone */}
                <div>
                    <label htmlFor="secondPhone" className="block text-sm font-medium text-muted-foreground mb-2">
                        Second Phone (Optional)
                    </label>
                    <div className="relative">
                        <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="tel"
                            id="secondPhone"
                            value={formData.secondPhone || ''}
                            onChange={(e) => setFormData({ ...formData, secondPhone: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                        />
                    </div>
                </div>

                {/* Email */}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
                        Email (Optional)
                    </label>
                    <div className="relative">
                        <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="email"
                            id="email"
                            value={formData.email || ''}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                        />
                    </div>
                </div>

                {/* City */}
                <div>
                    <label htmlFor="city" className="block text-sm font-medium text-muted-foreground mb-2">
                        City
                    </label>
                    <div className="relative">
                        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                        />
                    </div>
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-muted-foreground mb-2">
                        Address
                    </label>
                    <div className="relative">
                        <MapPinIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                            required
                        />
                    </div>
                </div>

                {/* Source */}
                <div>
                    <label htmlFor="source" className="block text-sm font-medium text-muted-foreground mb-2">
                        Source
                    </label>
                    <div className="relative">
                        <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            id="source"
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                        />
                    </div>
                </div>

                {/* Product */}
                <div>
                    <label htmlFor="product" className="block text-sm font-medium text-muted-foreground mb-2">
                        Product
                    </label>
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
                                <option key={product.code} value={product.code}>
                                    {product.name} - {product.code}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Quantity */}
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-muted-foreground mb-2">
                        Quantity
                    </label>
                    <div className="relative">
                        <HashtagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="number"
                            id="quantity"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                            required
                        />
                    </div>
                </div>

                {/* Discount */}
                <div>
                    <label htmlFor="discount" className="block text-sm font-medium text-muted-foreground mb-2">
                        Discount
                    </label>
                    <div className="relative">
                        <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="number"
                            id="discount"
                            min="0"
                            value={formData.discount}
                            onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                        />
                    </div>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground mb-2">
                        Notes (Optional)
                    </label>
                    <div className="relative">
                        <DocumentTextIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <textarea
                            id="notes"
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5 resize-none"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="flex justify-end space-x-4 pt-4 border-t border-border">
                <motion.button
                    type="button"
                    onClick={onCancel}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Cancel
                </motion.button>
                <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </motion.button>
            </div>
        </form>
    );
}