// src/components/leads/lead-actions.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'next-auth';
import type { LeadWithDetails } from '@/app/(authenticated)/leads/page';
import Link from 'next/link';
import { format } from 'date-fns';
import { ShippingModal } from '@/components/orders/shipping-modal';

// Define the structure for a potential duplicate lead
interface PotentialDuplicate {
    productName: string;
    customerName: string;
    confirmedDate: string;
}

// --- Confirmation Modal Component ---
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl ring-1 ring-border">
                <h2 className="text-xl font-bold text-card-foreground">Potential Duplicate Leads Found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    This customer has recently purchased similar products from other companies.
                </p>

                <div className="mt-4 h-64 max-h-[50vh] overflow-y-auto rounded-md border border-border">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Product Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Confirmed Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {duplicates.map((lead, index) => (
                                <tr key={index}>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lead.productName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lead.customerName}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{format(new Date(lead.confirmedDate), 'MMM d, yyyy')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isCreating}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isCreating ? 'Creating...' : 'Proceed Anyway'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// --- Main LeadActions Component ---
export function LeadActions({
    lead,
    user,
    onAction,
    tenantConfig
}: {
    lead: LeadWithDetails,
    user: User,
    onAction: () => void,
    tenantConfig?: {
        fardaExpressClientId?: string;
        fardaExpressApiKey?: string;
        transExpressApiKey?: string;
        royalExpressApiKey?: string;
        royalExpressOrderPrefix?: string;
    }
}) {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([]);

    // --- PERMISSION CHECKS ---
    const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_LEADS');
    const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_LEADS');
    const canCreateOrder = user.role === 'ADMIN' || user.permissions?.includes('CREATE_ORDERS');

    const handleCreateOrder = async (force: boolean = false) => {
        setIsCreating(true);
        try {
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: lead.id,
                    forceCreate: force,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to process order creation.');
            }

            // If the API requires confirmation, show the modal
            if (result.requiresConfirmation) {
                setPotentialDuplicates(result.potentialDuplicates);
                setIsModalOpen(true);
            } else {
                // Otherwise, the order was created, so navigate to it
                setIsModalOpen(false);
                router.push(`/orders/${result.id}?returnTo=leads`);
                onAction(); // Refresh the leads list
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'An unknown error occurred.');
            setIsModalOpen(false);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async () => {
        // NOTE: Using a custom modal for this would be better than confirm()
        if (confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/leads/${lead.id}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to delete lead');
                }
                onAction();
            } catch (err) {
                alert(err instanceof Error ? err.message : 'An error occurred.');
            }
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            const response = await fetch(`/api/leads/${lead.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update status');
            }

            onAction(); // Refresh the leads list
        } catch (err) {
            alert(err instanceof Error ? err.message : 'An error occurred.');
        }
    };

    // Check if order can be shipped (PENDING or CONFIRMED status and not already shipped)
    const canShipOrder = lead.order &&
        ['PENDING', 'CONFIRMED'].includes(lead.order.status) &&
        !lead.order.shippingProvider &&
        canCreateOrder;

    // Only render actions for PENDING, NO_ANSWER leads, or orders that can be shipped
    if (lead.status !== 'PENDING' && lead.status !== 'NO_ANSWER' && !canShipOrder) {
        return null;
    }

    return (
        <>
            <div className="flex items-center space-x-3">
                {/* Ship Order Button for orders that can be shipped */}
                {canShipOrder && (
                    <button
                        onClick={() => setIsShippingModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
                    >
                        Ship Order
                    </button>
                )}

                {/* Actions for PENDING leads */}
                {lead.status === 'PENDING' && (
                    <>
                        {/* --- CREATE ORDER BUTTON --- */}
                        {canCreateOrder && !lead.order && (
                            <button
                                onClick={() => handleCreateOrder(false)}
                                disabled={isCreating}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                            >
                                {isCreating ? 'Processing...' : 'Create Order'}
                            </button>
                        )}

                        {canEdit && (
                            <Link
                                href={`/leads/${lead.id}`}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                                Edit
                            </Link>
                        )}

                        {canDelete && (
                            <button
                                onClick={handleDelete}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                            >
                                Delete
                            </button>
                        )}
                    </>
                )}

                {/* Actions for NO_ANSWER leads */}
                {lead.status === 'NO_ANSWER' && (
                    <>
                        {canEdit && (
                            <button
                                onClick={() => handleStatusChange('PENDING')}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400 dark:hover:bg-yellow-500/20 transition-colors"
                            >
                                Move to Pending
                            </button>
                        )}

                        {canEdit && (
                            <button
                                onClick={() => handleStatusChange('REJECTED')}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                            >
                                Reject
                            </button>
                        )}

                        {canDelete && (
                            <button
                                onClick={handleDelete}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                            >
                                Delete
                            </button>
                        )}

                        {canEdit && (
                            <Link
                                href={`/leads/${lead.id}`}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                                Edit
                            </Link>
                        )}
                    </>
                )}
            </div>

            {/* --- RENDER THE CONFIRMATION MODAL --- */}
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={() => handleCreateOrder(true)}
                duplicates={potentialDuplicates}
                isCreating={isCreating}
            />

            {/* --- RENDER THE SHIPPING MODAL --- */}
            {canShipOrder && lead.order && tenantConfig && (
                <ShippingModal
                    isOpen={isShippingModalOpen}
                    onClose={() => setIsShippingModalOpen(false)}
                    orderId={lead.order.id}
                    order={{
                        customerName: lead.order.customerName,
                        customerPhone: lead.order.customerPhone,
                        customerSecondPhone: lead.order.customerSecondPhone || undefined,
                        customerAddress: lead.order.customerAddress,
                        customerCity: lead.order.customerCity || undefined,
                        product: {
                            name: lead.product.name,
                            price: lead.product.price,
                        },
                        quantity: lead.order.quantity,
                        discount: lead.order.discount || undefined,
                    }}
                    fardaExpressClientId={tenantConfig.fardaExpressClientId}
                    fardaExpressApiKey={tenantConfig.fardaExpressApiKey}
                    transExpressApiKey={tenantConfig.transExpressApiKey}
                    royalExpressApiKey={tenantConfig.royalExpressApiKey}
                    royalExpressOrderPrefix={tenantConfig.royalExpressOrderPrefix}
                    onSuccess={onAction}
                />
            )}
        </>
    );
}
