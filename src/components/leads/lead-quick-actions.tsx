'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    ShoppingCartIcon,
    PhoneXMarkIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * Genzo-style inline lead actions for the Lead List "Add Order" column.
 * One-click: Add Order (create order from lead), No answer, Reject.
 * Reuses the same endpoints as LeadActions:
 *   - POST /api/orders/create        { leadId, forceCreate }
 *   - PUT  /api/leads/{id}/status    { status }
 */
export function LeadQuickActions({
    lead,
    user,
    onAction,
}: {
    lead: {
        id: string;
        status: string;
        order?: { id: string } | null;
    };
    user: { role?: string | null; permissions?: string[] };
    onAction: () => void;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<null | 'order' | 'noans' | 'reject'>(null);

    const canCreateOrder = user.role === 'ADMIN' || user.permissions?.includes('CREATE_ORDERS');
    const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_LEADS');

    const setStatus = async (status: 'NO_ANSWER' | 'REJECTED', key: 'noans' | 'reject') => {
        setBusy(key);
        try {
            const res = await fetch(`/api/leads/${lead.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e.error || 'Failed to update status');
            }
            toast.success(status === 'NO_ANSWER' ? 'Marked as No answer' : 'Lead rejected');
            onAction();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setBusy(null);
        }
    };

    const createOrder = async (force = false) => {
        setBusy('order');
        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId: lead.id, forceCreate: force }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to create order');

            if (result.requiresConfirmation) {
                const proceed = window.confirm(
                    'This customer may have recently purchased a similar product elsewhere. Create the order anyway?'
                );
                if (proceed) return createOrder(true);
                return;
            }
            toast.success('Order created');
            router.push(`/orders/${result.id}?returnTo=leads`);
            onAction();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setBusy(null);
        }
    };

    // Already converted → link to the order
    if (lead.status === 'CONFIRMED' && lead.order) {
        return (
            <Link href={`/orders/${lead.order.id}`} title="View order"
                className="genzo-act text-[#3c8c3c] hover:bg-[#e3f3e3]">
                <ShoppingCartIcon className="h-4 w-4" />
            </Link>
        );
    }

    // Only actionable while the lead is open
    if (lead.status !== 'PENDING' && lead.status !== 'NO_ANSWER') return null;
    if (lead.order) return null;

    return (
        <div className="flex items-center gap-1">
            {canCreateOrder && (
                <button type="button" title="Add Order" disabled={busy !== null}
                    onClick={() => createOrder(false)}
                    className="genzo-act text-[#3a8ee6] hover:bg-[#eaf4fd] disabled:opacity-40">
                    <ShoppingCartIcon className="h-4 w-4" />
                </button>
            )}
            {canEdit && lead.status === 'PENDING' && (
                <button type="button" title="No answer" disabled={busy !== null}
                    onClick={() => setStatus('NO_ANSWER', 'noans')}
                    className="genzo-act text-[#caa11e] hover:bg-[#fbf7cf] disabled:opacity-40">
                    <PhoneXMarkIcon className="h-4 w-4" />
                </button>
            )}
            {canEdit && (
                <button type="button" title="Reject" disabled={busy !== null}
                    onClick={() => {
                        if (window.confirm('Reject this lead?')) setStatus('REJECTED', 'reject');
                    }}
                    className="genzo-act text-[#c9453f] hover:bg-[#fdeceb] disabled:opacity-40">
                    <XCircleIcon className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
