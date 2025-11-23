// src/app/(authenticated)/search/page.tsx

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';
import { MagnifyingGlassIcon, UserIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface SearchResult {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    orders: Array<{
        id: string;
        createdAt: Date;
        status: string;
        product: {
            name: string;
            price: number;
        };
        quantity: number;
    }>;
}

export default function SearchPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);
        setHasSearched(true);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch search results');
            }

            const data = await response.json();
            setSearchResults(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        const colors = {
            pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 ring-yellow-500/20',
            confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20',
            shipped: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-500/20',
            delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 ring-green-500/20',
            returned: 'bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20',
            cancelled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 ring-gray-500/20',
        };
        return colors[status.toLowerCase() as keyof typeof colors] || colors.pending;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
            <div className="text-center space-y-4">
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Customer Search</h1>
                <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                    Find customers and their order history by name or phone number
                </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
                <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter customer name or phone number..."
                            className="w-full h-14 pl-12 pr-4 text-lg bg-card border border-border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/70"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSearch}
                        disabled={isLoading || !searchQuery.trim()}
                        className="h-14 px-8 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90 hover:shadow-xl disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span>Searching</span>
                            </div>
                        ) : (
                            'Search'
                        )}
                    </motion.button>
                </div>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl mx-auto rounded-2xl bg-destructive/10 p-4 text-center text-destructive font-medium"
                >
                    {error}
                </motion.div>
            )}

            {/* Search Results */}
            <div className="space-y-6">
                <AnimatePresence mode="wait">
                    {searchResults.length > 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid gap-6"
                        >
                            {searchResults.map((result, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    <div className="p-6 sm:p-8 border-b border-border bg-muted/30">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                                    <UserIcon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-foreground">{result.customerName}</h3>
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <PhoneIcon className="h-3.5 w-3.5" />
                                                            {result.customerPhone}
                                                        </span>
                                                        <span className="hidden sm:inline text-border">|</span>
                                                        <span className="flex items-center gap-1">
                                                            <MapPinIcon className="h-3.5 w-3.5" />
                                                            {result.customerAddress}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-medium text-muted-foreground">Total Orders</span>
                                                <p className="text-2xl font-bold text-foreground">{result.orders.length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 sm:p-8 bg-card">
                                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Order History</h4>
                                        <div className="space-y-4">
                                            {result.orders.map((order) => (
                                                <div key={order.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                                                    <div className="flex items-start gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <Link
                                                                    href={`/orders/${order.id}`}
                                                                    className="text-base font-bold text-foreground hover:text-primary transition-colors"
                                                                >
                                                                    Order #{order.id.slice(0, 8)}
                                                                </Link>
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 inset-0 ${getStatusColor(order.status)}`}>
                                                                    {order.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">
                                                                {format(new Date(order.createdAt), 'PPP')} at {format(new Date(order.createdAt), 'p')}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-6 min-w-[200px]">
                                                        <div className="text-right">
                                                            <p className="font-medium text-foreground">{order.product.name}</p>
                                                            <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                                                        </div>
                                                        <div className="text-right min-w-[100px]">
                                                            <p className="font-bold text-foreground">
                                                                {new Intl.NumberFormat('en-LK', {
                                                                    style: 'currency',
                                                                    currency: 'LKR'
                                                                }).format(order.product.price * order.quantity)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : hasSearched && !isLoading ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-md mx-auto text-center py-12"
                        >
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                                <MagnifyingGlassIcon className="h-10 w-10 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">No customers found</h3>
                            <p className="text-muted-foreground">
                                We couldn't find any customers matching "{searchQuery}". Try searching with a different name or phone number.
                            </p>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}
