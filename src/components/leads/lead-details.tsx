// src/components/leads/lead-details.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { LeadEditModal } from './lead-edit-modal';
import { PencilIcon } from '@heroicons/react/24/solid';

// --- Reusable Interfaces ---
interface Product {
    id: string;
    name: string;
    code: string;
    price: number;
}

interface User {
    id: string;
    name: string | null;
    email: string;
}

interface Order {
    id: string;
    status: string;
    product: Product;
    quantity: number;
    createdAt: Date;
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
    status: string;
    product: Product;
    assignedTo: User;
    createdAt: Date;
    order?: Order | null;
}

interface LeadDetailsProps {
    lead: Lead;
}

// --- NEW: Interface for duplicate leads ---
interface PotentialDuplicate {
    productName: string;
    customerName: string;
    confirmedDate: string;
}

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'NO_ANSWER', label: 'No Answer' },
    { value: 'REJECTED', label: 'Rejected' },
];


// --- NEW: Reusable Confirmation Modal Component ---
function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    duplicates,
    isCreating,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    duplicates: PotentialDuplicate[];
    isCreating: boolean;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
            <div className="w-full max-w-2xl rounded-lg bg-gray-800 p-6 shadow-xl ring-1 ring-white/10">
                <h2 className="text-xl font-bold text-white">Potential Duplicate Leads Found</h2>
                <p className="mt-2 text-sm text-gray-400">
                    This customer has recently purchased similar products from other companies.
                </p>
                <div className="mt-4 h-64 max-h-[50vh] overflow-y-auto rounded-md border border-gray-700">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Product Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Customer Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Confirmed Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 bg-gray-800">
                            {duplicates.map((lead, index) => (
                                <tr key={index}>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{lead.productName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{lead.customerName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{format(new Date(lead.confirmedDate), 'MMM d, yyyy')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} disabled={isCreating} className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-500 disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={isCreating} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {isCreating ? 'Creating...' : 'Proceed Anyway'}
                    </button>
                </div>
            </div>
        </div>
    );
}


export function LeadDetails({ lead }: LeadDetailsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [products, setProducts] = useState<Product[]>([lead.product]);

    // --- NEW: State for confirmation modal ---
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([]);


    const openEditModal = async () => {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const data = await response.json();
                setProducts(data);
            }
            setIsEditModalOpen(true);
        } catch (err) {
            console.error('Failed to fetch products:', err);
            setIsEditModalOpen(true);
        }
    };

    // --- UPDATED: handleCreateOrder function ---
    const handleCreateOrder = async (force: boolean = false) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: lead.id,
                    quantity: lead.csvData.quantity || 1,
                    forceCreate: force,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create order');
            }

            if (result.requiresConfirmation) {
                setPotentialDuplicates(result.potentialDuplicates);
                setIsConfirmationModalOpen(true);
            } else {
                setIsConfirmationModalOpen(false);
                router.push(`/orders/${result.id}`);
                router.refresh();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setIsConfirmationModalOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/leads/${lead.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update status');
            }
            // Redirect back to leads page after successful status update
            router.push('/leads');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="space-y-6">
                {/* Status Update */}
                {lead.status !== 'CONFIRMED' && (
                    <div>
                        <h3 className="text-lg font-medium text-white mb-4">Lead Status</h3>
                        <div className="flex items-center space-x-4">
                            <select
                                value={lead.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={isLoading}
                                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            >
                                {STATUS_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {isLoading && (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                            )}
                        </div>
                    </div>
                )}

                {/* Customer Information */}
                <div>
                    <h3 className="text-lg font-medium text-white mb-4">Customer Information</h3>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Name</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                {(lead.csvData as any).name || (lead.csvData as any).customer_name || 'Unnamed Lead'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Phone</dt>
                            <dd className="mt-1 text-sm text-gray-100">{lead.csvData.phone}</dd>
                        </div>
                        {lead.csvData.secondPhone && (
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Second Phone</dt>
                                <dd className="mt-1 text-sm text-gray-100">{lead.csvData.secondPhone}</dd>
                            </div>
                        )}
                        {((lead.csvData as any).email) && (
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Email</dt>
                                <dd className="mt-1 text-sm text-gray-100">{(lead.csvData as any).email}</dd>
                            </div>
                        )}
                        <div>
                            <dt className="text-sm font-medium text-gray-400">City</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                {(lead.csvData as any).city || (lead.csvData as any).customer_city || ''}
                            </dd>
                        </div>
                        <div className="sm:col-span-2">
                            <dt className="text-sm font-medium text-gray-400">Address</dt>
                            <dd className="mt-1 text-sm text-gray-100">{lead.csvData.address}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Source</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                {(lead.csvData as any).source || (lead.csvData as any).customer_source || ''}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Created</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                {format(new Date(lead.createdAt), 'PPp')}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Quantity</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                {(lead.csvData as any).quantity || 1}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Discount</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                {(lead.csvData as any).discount ? `LKR ${(lead.csvData as any).discount.toLocaleString()}` : 'LKR 0'}
                            </dd>
                        </div>
                        {((lead.csvData as any).notes || (lead.csvData as any).customer_notes) && (
                            <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-gray-400">Notes</dt>
                                <dd className="mt-1 text-sm text-gray-100">
                                    {(lead.csvData as any).notes || (lead.csvData as any).customer_notes}
                                </dd>
                            </div>
                        )}
                    </dl>
                </div>

                {/* Product Information */}
                <div>
                    <h3 className="text-lg font-medium text-white mb-4">Product Information</h3>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Product</dt>
                            <dd className="mt-1 text-sm text-gray-100">{lead.product.name}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Code</dt>
                            <dd className="mt-1 text-sm text-gray-100">{lead.product.code}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Price</dt>
                            <dd className="mt-1 text-sm text-gray-100">
                                LKR {lead.product.price.toLocaleString()}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Order Information */}
                {lead.order && (
                    <div>
                        <h3 className="text-lg font-medium text-white mb-4">Order Information</h3>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Order ID</dt>
                                <dd className="mt-1 text-sm text-gray-100">{lead.order.id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Status</dt>
                                <dd className="mt-1 text-sm text-gray-100">{lead.order.status.toLowerCase()}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Quantity</dt>
                                <dd className="mt-1 text-sm text-gray-100">{lead.order.quantity}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Created</dt>
                                <dd className="mt-1 text-sm text-gray-100">
                                    {format(new Date(lead.order.createdAt), 'PPp')}
                                </dd>
                            </div>
                        </dl>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg bg-red-900/50 p-4 text-sm text-red-400 ring-1 ring-red-500">
                        {error}
                    </div>
                )}

                {/* Actions */}
                {lead.status === 'PENDING' && (
                    <div className="flex justify-end space-x-4">
                        <motion.button
                            type="button"
                            onClick={openEditModal}
                            disabled={isLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center rounded-md border border-indigo-700 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit Lead
                        </motion.button>
                        <motion.button
                            type="button"
                            onClick={() => handleStatusChange('NO_ANSWER')}
                            disabled={isLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center rounded-md border border-orange-700 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-900/50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        >
                            Mark as No Answer
                        </motion.button>
                        <motion.button
                            type="button"
                            onClick={() => handleStatusChange('REJECTED')}
                            disabled={isLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center rounded-md border border-red-700 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                            Reject Lead
                        </motion.button>
                        <motion.button
                            type="button"
                            onClick={() => handleCreateOrder(false)}
                            disabled={isLoading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                            {isLoading ? 'Processing...' : 'Create Order'}
                        </motion.button>
                    </div>
                )}

                {/* Edit Modal */}
                <LeadEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    lead={lead}
                    products={products}
                />
            </div>
            {/* --- NEW: Render the confirmation modal --- */}
            <ConfirmationModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={() => handleCreateOrder(true)}
                duplicates={potentialDuplicates}
                isCreating={isLoading}
            />
        </>
    );
}
