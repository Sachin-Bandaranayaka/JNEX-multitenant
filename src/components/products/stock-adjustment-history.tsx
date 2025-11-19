'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';

// --- FIX: Make 'adjustedBy' optional to match the parent component's type ---
interface StockAdjustment {
    id: string;
    quantity: number;
    reason: string;
    previousStock: number;
    newStock: number;
    createdAt: string;
    adjustedBy?: { // The '?' makes this property optional
        name: string | null;
        email: string;
    };
}

interface StockAdjustmentHistoryProps {
    adjustments: StockAdjustment[];
}

export function StockAdjustmentHistory({ adjustments }: StockAdjustmentHistoryProps) {
    if (adjustments.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No stock adjustments found
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {adjustments.map((adjustment, index) => (
                <motion.div
                    key={adjustment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-accent/30 rounded-lg p-4 ring-1 ring-border"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${adjustment.quantity > 0
                                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 ring-1 ring-green-500/30'
                                        : 'bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-500/30'
                                    }`}>
                                    {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                    {adjustment.reason}
                                </span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                Previous: {adjustment.previousStock} → New: {adjustment.newStock}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-muted-foreground">
                                {format(new Date(adjustment.createdAt), 'PPp')}
                            </div>
                            {/* --- FIX: Safely access the optional 'adjustedBy' property --- */}
                            {adjustment.adjustedBy && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                    by {adjustment.adjustedBy.name || adjustment.adjustedBy.email}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}