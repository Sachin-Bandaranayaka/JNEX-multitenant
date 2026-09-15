'use client';
import { useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { PendingOrderActions, PendingOrder } from './pending-order-actions';
export function OrderDetailActions({ order, user, hasTransExpress }: { order: PendingOrder; user: User; hasTransExpress: boolean }) {
    const router = useRouter();
    return <PendingOrderActions order={order} user={user} hasTransExpress={hasTransExpress} onUpdated={() => router.refresh()} onDeleted={() => router.refresh()} />;
}
