// src/app/(authenticated)/search/page.tsx

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';

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

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);

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
            PENDING: 'bg-yellow-900/50 text-yellow-300 ring-yellow-500/50',
            CONFIRMED: 'bg-blue-900/50 text-blue-300 ring-blue-500/50',
            SHIPPED: 'bg-purple-900/50 text-purple-300 ring-purple-500/50',
            DELIVERED: 'bg-green-900/50 text-green-300 ring-green-500/50',
            RETURNED: 'bg-red-900/50 text-red-300 ring-red-500/50',
        };
        return colors[status as keyof typeof colors] || colors.PENDING;
    };

    return (
        <div className="space-y-6 bg-gray-900">
            <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white leading-tight">Customer Search</h1>
                <p className="mt-2 text-sm sm:text-base text-gray-400 leading-relaxed">
                    Search for customers by name or phone number
                </p>
            </div>

            {/* Search Bar */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter customer name or phone number..."
                        className="w-full rounded-lg border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
                    />
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSearch}
                    disabled={isLoading || !searchQuery.trim()}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-6 py-3 sm:px-4 sm:py-2 text-base sm:text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 touch-manipulation min-h-[44px]"
                >
                    {isLoading ? (
                        <>
                            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Searching...
                        </>
                    ) : (
                        <>
                            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Search
                        </>
                    )}
                </motion.button>
            </div>

            {error && (
                <div className="rounded-lg bg-red-900/50 p-4 text-sm text-red-400 ring-1 ring-red-500">
                    {error}
                </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 ? (
                <div className="space-y-4">
                    {searchResults.map((result, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="rounded-lg bg-gray-800 p-6 ring-1 ring-white/10"
                        >
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-white">{result.customerName}</h3>
                                <div className="mt-1 text-sm text-gray-400">
                                    <p>📞 {result.customerPhone}</p>
                                    <p>📍 {result.customerAddress}</p>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-700">
                                <h4 className="mb-2 text-sm font-medium text-gray-300">Order History</h4>
                                {result.orders.map((order) => (
                                    <div key={order.id} className="py-3">
                                        <div className="flex items-center justify-between">
                                            <Link
                                                href={`/orders/${order.id}`}
                                                className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
                                            >
                                                Order #{order.id}
                                            </Link>
                                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {order.status.toLowerCase()}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-sm text-gray-400">
                                            <span>{order.product.name} × {order.quantity}</span>
                                            <span>
                                                {new Intl.NumberFormat('en-LK', {
                                                    style: 'currency',
                                                    currency: 'LKR'
                                                }).format(order.product.price * order.quantity)}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">
                                            {format(new Date(order.createdAt), 'PPp')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : searchQuery && !isLoading ? (
                <div className="rounded-lg bg-gray-800 p-8 text-center text-gray-400 ring-1 ring-white/10">
                    No results found for "{searchQuery}"
                </div>
            ) : null}
        </div>
    );
}
 