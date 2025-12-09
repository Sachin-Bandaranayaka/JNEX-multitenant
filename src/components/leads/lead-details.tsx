'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { LeadEditModal } from './lead-edit-modal';
import {
    PencilIcon,
    UserIcon,
    PhoneIcon,
    MapPinIcon,
    CalendarIcon,
    TagIcon,
    CubeIcon,
    CurrencyDollarIcon,
    ClipboardDocumentListIcon,
    CheckCircleIcon,
    XCircleIcon,
    NoSymbolIcon,
    ShoppingCartIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

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
    { value: 'PENDING', label: 'Pending', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    { value: 'NO_ANSWER', label: 'No Answer', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { value: 'REJECTED', label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    { value: 'CONFIRMED', label: 'Confirmed', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl ring-1 ring-border"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500">
                        <ExclamationTriangleIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Potential Duplicate Leads Found</h2>
                        <p className="text-sm text-muted-foreground">
                            This customer has recently purchased similar products from other companies.
                        </p>
                    </div>
                </div>

                <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-lg border border-border">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Product Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Confirmed Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {duplicates.map((lead, index) => (
                                <tr key={index} className="hover:bg-muted/50 transition-colors">
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lead.productName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lead.customerName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{format(new Date(lead.confirmedDate), 'MMM d, yyyy')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isCreating}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isCreating ? 'Creating...' : 'Proceed Anyway'}
                    </button>
                </div>
            </motion.div>
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

    const StatusBadge = ({ status }: { status: string }) => {
        const option = STATUS_OPTIONS.find(o => o.value === status) || { label: status, color: 'bg-muted text-muted-foreground' };
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${option.color}`}>
                {option.label}
            </span>
        );
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Customer & Product Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Information Card */}
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-foreground">Customer Information</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Name</dt>
                                <dd className="text-base font-medium text-foreground flex items-center gap-2">
                                    {(lead.csvData as any).name || (lead.csvData as any).customer_name || 'Unnamed Lead'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Phone</dt>
                                <dd className="text-base font-medium text-foreground flex items-center gap-2">
                                    <PhoneIcon className="w-4 h-4 text-muted-foreground" />
                                    {lead.csvData.phone}
                                </dd>
                            </div>
                            {lead.csvData.secondPhone && (
                                <div>
                                    <dt className="text-sm font-medium text-muted-foreground mb-1">Second Phone</dt>
                                    <dd className="text-base font-medium text-foreground flex items-center gap-2">
                                        <PhoneIcon className="w-4 h-4 text-muted-foreground" />
                                        {lead.csvData.secondPhone}
                                    </dd>
                                </div>
                            )}
                            {((lead.csvData as any).email) && (
                                <div>
                                    <dt className="text-sm font-medium text-muted-foreground mb-1">Email</dt>
                                    <dd className="text-base font-medium text-foreground">{(lead.csvData as any).email}</dd>
                                </div>
                            )}
                            <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Address</dt>
                                <dd className="text-base font-medium text-foreground flex items-start gap-2">
                                    <MapPinIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
                                    <span>
                                        {lead.csvData.address}
                                        {((lead.csvData as any).city || (lead.csvData as any).customer_city) && `, ${(lead.csvData as any).city || (lead.csvData as any).customer_city}`}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Source</dt>
                                <dd className="text-base font-medium text-foreground flex items-center gap-2">
                                    <TagIcon className="w-4 h-4 text-muted-foreground" />
                                    {(lead.csvData as any).source || (lead.csvData as any).customer_source || 'N/A'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Created</dt>
                                <dd className="text-base font-medium text-foreground flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                                    {format(new Date(lead.createdAt), 'PPp')}
                                </dd>
                            </div>
                            {((lead.csvData as any).notes || (lead.csvData as any).customer_notes) && (
                                <div className="sm:col-span-2">
                                    <dt className="text-sm font-medium text-muted-foreground mb-1">Notes</dt>
                                    <dd className="text-sm text-foreground bg-muted/50 p-3 rounded-lg border border-border">
                                        {(lead.csvData as any).notes || (lead.csvData as any).customer_notes}
                                    </dd>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Information Card */}
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                            <CubeIcon className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-foreground">Product Information</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Product Name</dt>
                                <dd className="text-lg font-medium text-foreground">{lead.product.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Product Code</dt>
                                <dd className="text-base font-mono text-foreground bg-muted/50 px-2 py-1 rounded inline-block">
                                    {lead.product.code}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Price</dt>
                                <dd className="text-lg font-medium text-foreground flex items-center gap-1">
                                    <span className="text-muted-foreground text-sm">LKR</span>
                                    {lead.product.price.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Quantity</dt>
                                <dd className="text-lg font-medium text-foreground">
                                    {(lead.csvData as any).quantity || 1}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground mb-1">Discount</dt>
                                <dd className="text-lg font-medium text-foreground flex items-center gap-1">
                                    <span className="text-muted-foreground text-sm">LKR</span>
                                    {(lead.csvData as any).discount ? (lead.csvData as any).discount.toLocaleString() : '0'}
                                </dd>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Status & Actions */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                            <ClipboardDocumentListIcon className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-foreground">Lead Status</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Current Status</span>
                                <StatusBadge status={lead.status} />
                            </div>

                            {lead.status !== 'CONFIRMED' && (
                                <div className="space-y-3 pt-4 border-t border-border">
                                    <label className="text-sm font-medium text-foreground">Update Status</label>
                                    <select
                                        value={lead.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        disabled={isLoading}
                                        className="block w-full rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2.5"
                                    >
                                        {STATUS_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Card */}
                    {lead.status === 'PENDING' && (
                        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-border">
                                <h3 className="font-semibold text-foreground">Actions</h3>
                            </div>
                            <div className="p-6 space-y-3">
                                <motion.button
                                    type="button"
                                    onClick={() => handleCreateOrder(false)}
                                    disabled={isLoading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                                >
                                    <ShoppingCartIcon className="mr-2 h-4 w-4" />
                                    {isLoading ? 'Processing...' : 'Create Order'}
                                </motion.button>

                                <div className="grid grid-cols-2 gap-3">
                                    <motion.button
                                        type="button"
                                        onClick={() => handleStatusChange('NO_ANSWER')}
                                        disabled={isLoading}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-500 hover:bg-orange-500/20"
                                    >
                                        <NoSymbolIcon className="mr-2 h-4 w-4" />
                                        No Answer
                                    </motion.button>
                                    <motion.button
                                        type="button"
                                        onClick={() => handleStatusChange('REJECTED')}
                                        disabled={isLoading}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20"
                                    >
                                        <XCircleIcon className="mr-2 h-4 w-4" />
                                        Reject
                                    </motion.button>
                                </div>

                                <motion.button
                                    type="button"
                                    onClick={openEditModal}
                                    disabled={isLoading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                    <PencilIcon className="mr-2 h-4 w-4" />
                                    Edit Details
                                </motion.button>
                            </div>
                        </div>
                    )}

                    {/* Order Information Card (if exists) */}
                    {lead.order && (
                        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                                <ShoppingCartIcon className="w-5 h-5 text-primary" />
                                <h3 className="font-semibold text-foreground">Associated Order</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Order ID</span>
                                    <span className="text-sm font-mono text-foreground">{lead.order.id.slice(0, 8)}...</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                        {lead.order.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Created</span>
                                    <span className="text-sm text-foreground">{format(new Date(lead.order.createdAt), 'PP')}</span>
                                </div>
                                <button
                                    onClick={() => router.push(`/orders/${lead.order?.id}`)}
                                    className="w-full mt-2 flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                    View Order
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-4 right-4 z-50 rounded-lg bg-destructive text-destructive-foreground px-4 py-3 shadow-lg"
                >
                    {error}
                </motion.div>
            )}

            {/* Edit Modal */}
            <LeadEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                lead={lead}
                products={products}
            />

            {/* Confirmation Modal */}
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
