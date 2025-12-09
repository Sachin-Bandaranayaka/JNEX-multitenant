'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LeadEditForm } from './lead-edit-form';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface Product {
    id: string;
    name: string;
    code: string;
    price?: number;
}

interface Lead {
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
    };
    productCode: string;
    product: Product;
}

interface LeadEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead;
    products: Product[];
}

export function LeadEditModal({ isOpen, onClose, lead, products }: LeadEditModalProps) {
    // Close modal when Escape key is pressed
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
                    >
                        <div className="pointer-events-auto relative w-full max-w-4xl rounded-xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                                <h2 className="text-xl font-semibold text-foreground">Edit Lead</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <LeadEditForm
                                    lead={lead}
                                    products={products}
                                    onSuccess={onClose}
                                    onCancel={onClose}
                                    isModal={true}
                                />
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
} 