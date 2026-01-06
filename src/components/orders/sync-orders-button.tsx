'use client';

import { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface SyncResult {
    success: boolean;
    message: string;
    processed: number;
    updated?: number;
    failed?: number;
    updates?: Array<{
        orderId: string;
        success: boolean;
        previousStatus?: string;
        newStatus?: string;
        error?: string;
    }>;
}

export function SyncOrdersButton() {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        if (isSyncing) return;

        setIsSyncing(true);
        const toastId = toast.loading('Syncing orders with Royal Express...', {
            description: 'This may take a few minutes for many orders.',
        });

        try {
            const response = await fetch('/api/orders/sync-tracking', {
                method: 'POST',
            });

            const result: SyncResult = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to sync orders');
            }

            toast.dismiss(toastId);

            if (result.updated && result.updated > 0) {
                toast.success('Orders synced successfully!', {
                    description: `${result.updated} orders updated, ${result.failed || 0} failed.`,
                    duration: 5000,
                });
                // Refresh the page to show updated statuses
                window.location.reload();
            } else {
                toast.info('Sync complete', {
                    description: result.message || 'No orders needed updating.',
                    duration: 4000,
                });
            }
        } catch (error) {
            toast.dismiss(toastId);
            toast.error('Sync failed', {
                description: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSync}
            disabled={isSyncing}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm ${
                isSyncing
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
            }`}
        >
            <ArrowPathIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Royal Express'}
        </motion.button>
    );
}
