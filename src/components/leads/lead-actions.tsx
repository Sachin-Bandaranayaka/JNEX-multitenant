// src/components/leads/lead-actions.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'next-auth';
import type { LeadWithDetails } from '@/app/(authenticated)/leads/page';
import Link from 'next/link';
import { format } from 'date-fns';
import { ShippingModal } from '@/components/orders/shipping-modal';
import {
    EditableLeadReminder,
    LeadReminderModal,
} from '@/components/leads/lead-reminder-modal';
import { toast } from 'sonner';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { FaIcon } from '@/components/leads/fa-icons';

// Define the structure for a potential duplicate lead
interface PotentialDuplicate {
    productName: string;
    customerName: string;
    confirmedDate: string;
}

type LeadWithReminder = LeadWithDetails & {
    activeReminder?: EditableLeadReminder | null;
    reminders?: EditableLeadReminder[];
};

// --- Delete Confirmation Modal ---
function DeleteConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-500/10">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">Delete Lead</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    Are you sure you want to delete this lead? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Duplicate Confirmation Modal ---
function DuplicateConfirmModal({
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
            <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border">
                <h2 className="text-xl font-bold text-card-foreground">Potential Duplicate Leads Found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    This customer has recently purchased similar products from other companies.
                </p>

                <div className="mt-4 h-64 max-h-[50vh] overflow-y-auto rounded-xl border border-border">
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

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isCreating}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
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
    tenantConfig,
    returnTo = '/leads',
}: {
    lead: LeadWithDetails,
    user: User,
    onAction: () => void,
    tenantConfig?: {
        fardaExpressClientId?: string;
        fardaExpressApiKey?: string;
        transExpressApiKey?: string;
        transExpressOrderPrefix?: string;
        royalExpressApiKey?: string;
        royalExpressOrderPrefix?: string;
    };
    returnTo?: string;
}) {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
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
                body: JSON.stringify({ leadId: lead.id, forceCreate: force }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to process order creation.');
            }

            if (result.requiresConfirmation) {
                setPotentialDuplicates(result.potentialDuplicates);
                setIsDuplicateModalOpen(true);
            } else {
                setIsDuplicateModalOpen(false);
                router.push(`/orders/${result.id}?returnTo=leads`);
                onAction();
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
            setIsDuplicateModalOpen(false);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            // Soft delete: set status to DELETED instead of hard deleting
            const response = await fetch(`/api/leads/${lead.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'DELETED' }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete lead');
            }
            setIsDeleteModalOpen(false);
            toast.success('Lead deleted.');
            onAction();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setIsDeleting(false);
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

            onAction();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'An error occurred.');
        }
    };

    // Check if order can be shipped
    const canShipOrder = lead.order &&
        ['PENDING', 'CONFIRMED'].includes(lead.order.status) &&
        !lead.order.shippingProvider &&
        canCreateOrder;

    // A lead is "open" (still being worked) while PENDING or NO_ANSWER.
    const isOpen = lead.status === 'PENDING' || lead.status === 'NO_ANSWER';
    const leadWithReminder = lead as LeadWithReminder;
    const activeReminder = leadWithReminder.activeReminder ?? leadWithReminder.reminders?.[0] ?? null;
    // A confirmed lead that already has an order gets a quick link to it.
    const isConfirmedWithOrder = lead.status === 'CONFIRMED' && !!lead.order;

    // Nothing to show for closed leads (rejected/deleted) with no shippable order.
    if (!isOpen && !isConfirmedWithOrder && !canShipOrder) {
        return null;
    }

    // Reminder icon: the stroked clock from the reference design.
    const clock = (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ height: '1em', width: '1em' }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" />
        </svg>
    );
    const disabled = (title: string, icon: React.ReactNode, kind: string) => (
        <span className={`ll-act ${kind} is-disabled`} title={`${title} (no permission)`} aria-disabled="true">{icon}</span>
    );

    return (
        <>
            <div className="flex items-center gap-1.5">
                {/* Confirmed lead → jump straight to its order */}
                {isConfirmedWithOrder && lead.order && (
                    <Link href={`/orders/${lead.order.id}`} className="ll-act-pill">
                        View Order
                    </Link>
                )}

                {/* Ship Order — whenever an order exists and is still shippable */}
                {canShipOrder && (
                    <button type="button" onClick={() => setIsShippingModalOpen(true)} className="ll-act-pill">
                        <FaIcon name="truckFast" className="mr-1.5" /> Ship Order
                    </button>
                )}

                {/* --- Open leads (PENDING / NO_ANSWER) --- */}
                {isOpen && (
                    <>
                        {/* Confirm order */}
                        {canCreateOrder ? (
                            <Link
                                href={`/leads/new?leadId=${lead.id}&returnTo=${encodeURIComponent(returnTo)}`}
                                title="Confirm Order"
                                aria-label={`Confirm order for lead ${lead.number}`}
                                className="ll-act is-order"
                                onClick={() => {
                                    try {
                                        window.sessionStorage.setItem('jnex_leads_return_scroll', String(window.scrollY));
                                    } catch {
                                        // Storage may be unavailable in private browsing; URL state still survives.
                                    }
                                }}
                            >
                                <FaIcon name="cartPlus" />
                            </Link>
                        ) : disabled('Confirm Order', <FaIcon name="cartPlus" />, 'is-order')}

                        {/* No Answer toggle */}
                        {canEdit ? (
                            <button
                                type="button"
                                onClick={() => handleStatusChange(lead.status === 'PENDING' ? 'NO_ANSWER' : 'PENDING')}
                                title={lead.status === 'PENDING' ? 'Mark as No Answer' : 'Mark as Pending'}
                                aria-label={lead.status === 'PENDING' ? `Mark lead ${lead.number} as no answer` : `Mark lead ${lead.number} as pending`}
                                className="ll-act is-noans"
                            >
                                <FaIcon name="reply" />
                            </button>
                        ) : disabled('Toggle No Answer', <FaIcon name="reply" />, 'is-noans')}

                        {/* Reject */}
                        {canEdit ? (
                            <button
                                type="button"
                                onClick={() => { if (window.confirm('Reject this lead?')) handleStatusChange('REJECTED'); }}
                                title="Reject Lead"
                                aria-label={`Reject lead ${lead.number}`}
                                className="ll-act is-reject"
                            >
                                <FaIcon name="ban" />
                            </button>
                        ) : disabled('Reject Lead', <FaIcon name="ban" />, 'is-reject')}

                        {/* Schedule or edit a follow-up reminder */}
                        {canEdit ? (
                            <button
                                type="button"
                                onClick={() => setIsReminderModalOpen(true)}
                                title={activeReminder ? 'Reschedule Reminder' : 'Set Reminder'}
                                aria-label={activeReminder ? `Reschedule reminder for lead ${lead.number}` : `Set reminder for lead ${lead.number}`}
                                className={`ll-act is-remind${activeReminder ? ' is-active' : ''}`}
                            >
                                {clock}
                            </button>
                        ) : disabled('Set Reminder', clock, 'is-remind')}

                        {/* Edit */}
                        {canEdit ? (
                            <Link href={`/leads/${lead.id}?edit=true`} title="Edit Lead" aria-label={`Edit lead ${lead.number}`} className="ll-act is-edit">
                                <FaIcon name="pen" />
                            </Link>
                        ) : disabled('Edit Lead', <FaIcon name="pen" />, 'is-edit')}

                        {/* Delete */}
                        {canDelete ? (
                            <button type="button" onClick={() => setIsDeleteModalOpen(true)} title="Delete Lead" aria-label={`Delete lead ${lead.number}`} className="ll-act is-delete">
                                <FaIcon name="trash" />
                            </button>
                        ) : disabled('Delete Lead', <FaIcon name="trash" />, 'is-delete')}
                    </>
                )}
            </div>

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />

            <DuplicateConfirmModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                onConfirm={() => handleCreateOrder(true)}
                duplicates={potentialDuplicates}
                isCreating={isCreating}
            />

            {isOpen && (
                <LeadReminderModal
                    isOpen={isReminderModalOpen}
                    onClose={() => setIsReminderModalOpen(false)}
                    leadId={lead.id}
                    leadLabel={`Lead #${lead.number}`}
                    existingReminder={activeReminder}
                    onSaved={() => {
                        router.refresh();
                        onAction();
                    }}
                />
            )}

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
                        total: lead.order.total,
                        codAmount: lead.order.codAmount,
                        discount: lead.order.discount || undefined,
                        orderCode: lead.order.orderCode,
                    }}
                    fardaExpressClientId={tenantConfig.fardaExpressClientId}
                    fardaExpressApiKey={tenantConfig.fardaExpressApiKey}
                    transExpressApiKey={tenantConfig.transExpressApiKey}
                    royalExpressApiKey={tenantConfig.royalExpressApiKey}
                    transExpressOrderPrefix={tenantConfig.transExpressOrderPrefix}
                    royalExpressOrderPrefix={tenantConfig.royalExpressOrderPrefix}
                    orderNumber={lead.order.number}
                    onSuccess={onAction}
                />
            )}
        </>
    );
}
