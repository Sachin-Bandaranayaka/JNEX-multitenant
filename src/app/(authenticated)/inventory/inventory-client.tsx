'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { User } from 'next-auth';
import { StockAdjustmentForm } from '@/components/inventory/stock-adjustment-form';
import {
    CubeIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    AdjustmentsHorizontalIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';

// Define the types needed for this component
interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
    stock: number;
    lowStockAlert: number;
}

interface StockAdjustment {
    id: string;
    quantity: number;
    reason: string;
    previousStock: number;
    newStock: number;
    createdAt: string;
    adjustedBy?: { name: string | null; email: string; };
}

export function InventoryClient({ initialProducts, user }: { initialProducts: Product[], user: User }) {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const router = useRouter();

    const canEditStock = user.role === 'ADMIN' || user.permissions?.includes('EDIT_STOCK_LEVELS');

    useEffect(() => {
        if (selectedProduct) {
            fetchStockHistory(selectedProduct.id);
        } else {
            setStockAdjustments([]); // Clear history if no product is selected
        }
    }, [selectedProduct]);

    const fetchStockHistory = async (productId: string) => {
        setIsLoadingHistory(true);
        try {
            const response = await fetch(`/api/inventory/${productId}/history`);
            if (!response.ok) throw new Error('Failed to fetch stock history');
            const data = await response.json();
            setStockAdjustments(data);
        } catch (err) {
            console.error('Error fetching stock history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const getStockStatusColor = (stock: number, lowStockAlert: number) => {
        if (stock === 0) return 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20';
        if (stock <= lowStockAlert) return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20';
        return 'bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/20';
    };

    const handleOpenAdjustModal = (product: Product) => {
        setSelectedProduct(product);
        setShowAdjustModal(true);
    };

    const handleAdjustmentSuccess = () => {
        setShowAdjustModal(false);
        router.refresh();
    };

    return (
        <div className="space-y-8 p-4 sm:p-6 lg:p-8">
            <AnimatePresence>
                {showAdjustModal && selectedProduct && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card rounded-3xl p-6 w-full max-w-md border border-border shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground">Adjust Stock</h2>
                                <button
                                    onClick={() => setShowAdjustModal(false)}
                                    className="p-2 rounded-full hover:bg-muted transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                            <StockAdjustmentForm
                                product={selectedProduct}
                                onSuccess={handleAdjustmentSuccess}
                                onCancel={() => setShowAdjustModal(false)}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Track inventory levels and stock adjustment history</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {products.map((product, index) => (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => setSelectedProduct(product)}
                                className={`group cursor-pointer bg-card rounded-3xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${selectedProduct?.id === product.id ? 'ring-2 ring-primary border-primary' : 'border-border'}`}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                                <CubeIcon className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-foreground line-clamp-1" title={product.name}>
                                                    {product.name}
                                                </h3>
                                                <p className="text-sm text-muted-foreground font-mono">
                                                    {product.code}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Current Stock</p>
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ring-1 inset-0 ${getStockStatusColor(product.stock, product.lowStockAlert)}`}>
                                                {product.stock} units
                                            </span>
                                        </div>
                                        {canEditStock && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenAdjustModal(product); }}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                                            >
                                                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                                                Adjust
                                            </button>
                                        )}
                                    </div>

                                    {product.stock <= product.lowStockAlert && (
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                            <ExclamationTriangleIcon className="h-4 w-4" />
                                            Low stock alert (Threshold: {product.lowStockAlert})
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-card rounded-3xl border border-border shadow-sm overflow-hidden h-[calc(100vh-8rem)] flex flex-col">
                        <div className="px-6 py-4 border-b border-border bg-muted/30">
                            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                <ClockIcon className="h-5 w-5 text-muted-foreground" />
                                Stock History
                            </h3>
                            {selectedProduct ? (
                                <p className="text-sm text-muted-foreground mt-1 truncate">
                                    For <span className="font-medium text-foreground">{selectedProduct.name}</span>
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground mt-1">Select a product to view history</p>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {!selectedProduct ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
                                    <CubeIcon className="h-12 w-12 mb-4 opacity-20" />
                                    <p>Select a product from the list to view its stock adjustment history</p>
                                </div>
                            ) : isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-sm text-muted-foreground">Loading history...</p>
                                </div>
                            ) : stockAdjustments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
                                    <ClockIcon className="h-12 w-12 mb-4 opacity-20" />
                                    <p>No stock adjustments found for this product</p>
                                </div>
                            ) : (
                                stockAdjustments.map((adjustment, index) => (
                                    <motion.div
                                        key={adjustment.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-muted/30 rounded-2xl p-4 border border-border/50"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${adjustment.quantity > 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                                {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(adjustment.createdAt), 'MMM d, p')}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-foreground mb-1">{adjustment.reason}</p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                                            <span>{adjustment.previousStock} → {adjustment.newStock}</span>
                                            {adjustment.adjustedBy && (
                                                <span title={adjustment.adjustedBy.email}>
                                                    By: {adjustment.adjustedBy.name || 'Unknown'}
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}