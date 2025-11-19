'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { User } from 'next-auth';
import { StockAdjustmentForm } from '@/components/inventory/stock-adjustment-form';

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
        if (stock === 0) return 'bg-red-900/20 text-red-300 ring-red-400/30';
        if (stock <= lowStockAlert) return 'bg-yellow-900/20 text-yellow-300 ring-yellow-400/30';
        return 'bg-green-900/20 text-green-300 ring-green-400/30';
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
        <div className="container mx-auto px-4 py-8">
            {showAdjustModal && selectedProduct && (
                <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
                    <div className="bg-card rounded-lg p-6 w-full max-w-md ring-1 ring-border">
                        <h2 className="text-lg font-medium text-card-foreground mb-4">Adjust Stock for {selectedProduct.name}</h2>
                        <StockAdjustmentForm
                            product={selectedProduct}
                            onSuccess={handleAdjustmentSuccess}
                            onCancel={() => setShowAdjustModal(false)}
                        />
                    </div>
                </div>
            )}

            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Track inventory levels and stock adjustment history</p>
                </div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    {/* Mobile-optimized table container with horizontal scroll */}
                    <div className="bg-card ring-1 ring-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted">
                                    <tr>
                                        <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[200px]">Product</th>
                                        <th scope="col" className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[80px]">Stock</th>
                                        {canEditStock && <th scope="col" className="relative px-3 sm:px-6 py-3 min-w-[80px]"><span className="sr-only">Actions</span></th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                    {products.map((product) => (
                                        <tr key={product.id} className={`hover:bg-accent/50 active:bg-accent/70 cursor-pointer touch-manipulation transition-colors ${selectedProduct?.id === product.id ? 'bg-primary/10' : ''}`} onClick={() => setSelectedProduct(product)}>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                <div className="text-sm sm:text-base font-medium text-foreground">{product.name}</div>
                                                <div className="text-xs sm:text-sm text-muted-foreground">{product.code}</div>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                                                <span className={`inline-flex items-center px-2 sm:px-2.5 py-1 sm:py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getStockStatusColor(product.stock, product.lowStockAlert)}`}>
                                                    {product.stock}
                                                </span>
                                            </td>
                                            {canEditStock && (
                                                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenAdjustModal(product); }}
                                                        className="text-primary hover:text-primary/80 active:text-primary/60 touch-manipulation px-2 py-1 rounded transition-colors"
                                                    >
                                                        Adjust
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="bg-card ring-1 ring-border rounded-lg">
                        <div className="px-4 py-5 sm:px-6 border-b border-border">
                            <h3 className="text-lg font-medium text-card-foreground">Stock Adjustment History</h3>
                            {/* --- FIX: Use the selectedProduct object directly --- */}
                            {selectedProduct && (<p className="text-sm text-muted-foreground mt-1">{selectedProduct.name}</p>)}
                        </div>
                        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                            {!selectedProduct ? (
                                <div className="text-center py-12 text-muted-foreground">Select a product to view stock history</div>
                            ) : isLoadingHistory ? (
                                <div className="text-center py-12"><div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div><p className="mt-4 text-muted-foreground">Loading history...</p></div>
                            ) : stockAdjustments.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">No stock adjustments found</div>
                            ) : (
                                stockAdjustments.map((adjustment, index) => (
                                    <motion.div key={adjustment.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-accent/30 rounded-lg p-4 ring-1 ring-border">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${adjustment.quantity > 0 ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>{adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}</span>
                                                    <span className="text-sm font-medium text-foreground">{adjustment.reason}</span>
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground">Previous: {adjustment.previousStock} → New: {adjustment.newStock}</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{format(new Date(adjustment.createdAt), 'MMM d, p')}</div>
                                        </div>
                                        {adjustment.adjustedBy && (<div className="mt-2 text-xs text-muted-foreground">Adjusted by: {adjustment.adjustedBy.name || adjustment.adjustedBy.email}</div>)}
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}