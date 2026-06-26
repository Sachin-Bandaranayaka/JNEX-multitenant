'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TruckIcon, MapPinIcon, CalendarIcon, CubeIcon } from '@heroicons/react/24/outline';
import { ShippingProvider } from '@prisma/client';
import { toast } from 'sonner';

interface ShippedOrder {
    id: string;
    number: number;
    quantity: number;
    customerName: string;
    customerAddress: string;
    product: {
        name: string;
    };
    assignedTo: {
        name: string | null;
    } | null;
    shippedAt: Date | null;
    shippingProvider: ShippingProvider | null;
    trackingNumber: string | null;
}

interface ShippingListProps {
    orders: ShippedOrder[];
}

const SHIPPING_PROVIDERS: { key: ShippingProvider | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'All Partners' },
    { key: 'FARDA_EXPRESS', label: 'Farda Express' },
    { key: 'TRANS_EXPRESS', label: 'Trans Express' },
    { key: 'SL_POST', label: 'SL Post' },
    { key: 'ROYAL_EXPRESS', label: 'Royal Express' },
];

export function ShippingList({ orders }: ShippingListProps) {
    const [selectedProvider, setSelectedProvider] = useState<ShippingProvider | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<string>('shippedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const getTrackingUrl = (provider: string, trackingNumber: string) => {
        switch (provider) {
            case 'FARDA_EXPRESS':
                return `https://farda-express.com/track?id=${trackingNumber}`;
            case 'TRANS_EXPRESS':
                return `https://trans-express.net/track/${trackingNumber}`;
            case 'SL_POST':
                return `https://posta.lk/tracking?id=${trackingNumber}`;
            case 'ROYAL_EXPRESS':
                return `https://royal-express.lk/track/${trackingNumber}`;
            default:
                return '#';
        }
    };

    const formatProviderName = (provider: string) => {
        return provider.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    // Group orders by provider and count them (based on all orders, ignoring search)
    const orderCountByProvider = useMemo(() => {
        const counts: Record<string, number> = { ALL: orders.length };
        orders.forEach((order) => {
            if (order.shippingProvider) {
                counts[order.shippingProvider] = (counts[order.shippingProvider] || 0) + 1;
            }
        });
        return counts;
    }, [orders]);

    // 1. Filter orders based on selected provider
    const providerFilteredOrders = useMemo(() => {
        if (selectedProvider === 'ALL') return orders;
        return orders.filter((order) => order.shippingProvider === selectedProvider);
    }, [orders, selectedProvider]);

    // 2. Filter orders based on search term
    const searchedOrders = useMemo(() => {
        if (!searchTerm.trim()) return providerFilteredOrders;
        const term = searchTerm.toLowerCase().trim();
        return providerFilteredOrders.filter(order => {
            const orderNum = String(order.number || '').toLowerCase();
            const orderId = order.id.toLowerCase();
            const customer = order.customerName.toLowerCase();
            const address = order.customerAddress.toLowerCase();
            const product = order.product.name.toLowerCase();
            const tracking = (order.trackingNumber || '').toLowerCase();
            const provider = order.shippingProvider ? formatProviderName(order.shippingProvider).toLowerCase() : '';
            const agent = (order.assignedTo?.name || '').toLowerCase();

            return (
                orderNum.includes(term) ||
                orderId.includes(term) ||
                customer.includes(term) ||
                address.includes(term) ||
                product.includes(term) ||
                tracking.includes(term) ||
                provider.includes(term) ||
                agent.includes(term)
            );
        });
    }, [providerFilteredOrders, searchTerm]);

    // 3. Sort the searched orders
    const sortedOrders = useMemo(() => {
        const sorted = [...searchedOrders];
        sorted.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortField) {
                case 'number':
                    valA = a.number ?? 0;
                    valB = b.number ?? 0;
                    break;
                case 'quantity':
                    valA = a.quantity ?? 0;
                    valB = b.quantity ?? 0;
                    break;
                case 'shippingProvider':
                    valA = a.shippingProvider ? formatProviderName(a.shippingProvider) : '';
                    valB = b.shippingProvider ? formatProviderName(b.shippingProvider) : '';
                    break;
                case 'trackingNumber':
                    valA = a.trackingNumber ?? '';
                    valB = b.trackingNumber ?? '';
                    break;
                case 'shippedAt':
                    valA = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
                    valB = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
                    break;
                case 'assignedTo':
                    valA = a.assignedTo?.name ?? '';
                    valB = b.assignedTo?.name ?? '';
                    break;
                default:
                    valA = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
                    valB = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [searchedOrders, sortField, sortDirection]);

    // 4. Paginate
    const totalEntries = sortedOrders.length;
    const totalPages = Math.ceil(totalEntries / entriesPerPage);
    const activePage = Math.min(currentPage, Math.max(1, totalPages));

    const paginatedOrders = useMemo(() => {
        const startIndex = (activePage - 1) * entriesPerPage;
        return sortedOrders.slice(startIndex, startIndex + entriesPerPage);
    }, [sortedOrders, activePage, entriesPerPage]);

    // Header sort trigger
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) {
            return <span className="inline-block ml-1 text-slate-300 select-none">↕</span>;
        }
        return <span className="inline-block ml-1 text-primary select-none">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    // Exports
    const copyToClipboard = () => {
        const headers = ['#', 'Shipped Items', 'Deliver Company', 'Company Code', 'Shipped Date', 'User'];
        const rows = sortedOrders.map(order => [
            order.number || order.id.slice(0, 8),
            `${order.quantity} (${order.product.name})`,
            order.shippingProvider ? formatProviderName(order.shippingProvider) : 'Unknown',
            order.trackingNumber || '',
            order.shippedAt ? format(new Date(order.shippedAt), 'yyyy-MM-dd HH:mm:ss') : '',
            order.assignedTo?.name || 'Unassigned'
        ]);
        const text = [headers.join('\t'), ...rows.map(e => e.join('\t'))].join('\n');
        navigator.clipboard.writeText(text);
        toast.success('Copied table data to clipboard!');
    };

    const exportToCSV = () => {
        const headers = ['#', 'Shipped Items', 'Deliver Company', 'Company Code', 'Shipped Date', 'User'];
        const rows = sortedOrders.map(order => [
            order.number || order.id.slice(0, 8),
            `${order.quantity} (${order.product.name})`,
            order.shippingProvider ? formatProviderName(order.shippingProvider) : 'Unknown',
            order.trackingNumber || '',
            order.shippedAt ? format(new Date(order.shippedAt), 'yyyy-MM-dd HH:mm:ss') : '',
            order.assignedTo?.name || 'Unassigned'
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Shipped_List_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Downloaded CSV file!');
    };

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white border border-border/50 rounded-lg shadow-sm">
                <div className="bg-muted/50 rounded-full p-4 mb-4">
                    <TruckIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No shipped orders found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Orders will appear here once they are shipped.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Provider Tabs */}
            <div className="flex flex-wrap gap-2">
                {SHIPPING_PROVIDERS.map((provider) => {
                    const count = orderCountByProvider[provider.key] || 0;
                    const isActive = selectedProvider === provider.key;
                    
                    // Don't show tabs for providers with no orders (except ALL)
                    if (provider.key !== 'ALL' && count === 0) return null;

                    return (
                        <button
                            key={provider.key}
                            onClick={() => {
                                setSelectedProvider(provider.key);
                                setCurrentPage(1);
                            }}
                            className={`
                                inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                                ${isActive 
                                    ? 'bg-primary text-primary-foreground shadow-md' 
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }
                            `}
                        >
                            {provider.label}
                            <span className={`
                                inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold
                                ${isActive 
                                    ? 'bg-primary-foreground/20 text-primary-foreground' 
                                    : 'bg-muted text-muted-foreground'
                                }
                            `}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Main Table Card */}
            <div className="bg-white dark:bg-card border border-border/50 shadow-sm rounded-lg p-6 space-y-4">
                {/* Search & Export Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Show</span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => {
                                setEntriesPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="border border-[#ccd2da] bg-white text-slate-600 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-primary cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>entries</span>
                    </div>

                    {/* Search and Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>Search:</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="border border-[#ccd2da] bg-white text-slate-600 rounded px-3 py-1 text-xs focus:outline-none focus:border-primary w-48"
                                placeholder="Search Shipped List..."
                            />
                        </div>

                        {/* Export Toolbar */}
                        <div className="flex items-center gap-1 genzo-export">
                            <button onClick={copyToClipboard} title="Copy to clipboard">Copy</button>
                            <button onClick={exportToCSV} title="Download CSV">CSV</button>
                            <button onClick={exportToCSV} title="Download Excel">Excel</button>
                            <button onClick={() => window.print()} title="Print / Save PDF">PDF</button>
                            <button onClick={() => window.print()} title="Print Table">Print</button>
                        </div>
                    </div>
                </div>

                {/* Table display */}
                {totalEntries === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="bg-muted/50 rounded-full p-4 mb-4">
                            <TruckIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No matching shipped orders found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search terms or filter partner.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-md">
                        <table className="w-full text-sm border-collapse border border-slate-200 no-genzo-override">
                            <thead>
                                <tr className="border-b-2 border-slate-300 bg-white">
                                    <th 
                                        onClick={() => handleSort('number')}
                                        className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50"
                                    >
                                        # <SortIcon field="number" />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('quantity')}
                                        className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50"
                                    >
                                        Shipped Items <SortIcon field="quantity" />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('shippingProvider')}
                                        className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50"
                                    >
                                        Deliver Company <SortIcon field="shippingProvider" />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('trackingNumber')}
                                        className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50"
                                    >
                                        Company Code <SortIcon field="trackingNumber" />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('shippedAt')}
                                        className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] border-r border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50"
                                    >
                                        Shipped Date <SortIcon field="shippedAt" />
                                    </th>
                                    <th 
                                        onClick={() => handleSort('assignedTo')}
                                        className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50"
                                    >
                                        User <SortIcon field="assignedTo" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.map((order) => (
                                    <tr 
                                        key={order.id}
                                        className="odd:bg-[#f9fafb] even:bg-white hover:bg-slate-100/50 transition-colors"
                                    >
                                        <td className="px-3 py-2.5 text-[13px] font-semibold text-slate-700 whitespace-nowrap border-r border-b border-slate-200 align-middle">
                                            <Link href={`/orders/${order.id}`}>
                                                <span className="hover:text-primary transition-colors cursor-pointer text-[#e89c31] hover:underline">
                                                    {order.number || order.id.slice(0, 8)}
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2.5 text-[13px] border-r border-b border-slate-200 align-middle">
                                            <div className="font-semibold text-slate-800">{order.quantity}</div>
                                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]" title={order.product.name}>
                                                {order.product.name}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-[13px] font-medium text-slate-700 border-r border-b border-slate-200 align-middle">
                                            {order.shippingProvider ? formatProviderName(order.shippingProvider) : 'Unknown'}
                                        </td>
                                        <td className="px-3 py-2.5 text-[13px] font-mono text-xs whitespace-nowrap border-r border-b border-slate-200 align-middle">
                                            {order.trackingNumber && order.shippingProvider ? (
                                                <a
                                                    href={getTrackingUrl(order.shippingProvider, order.trackingNumber)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline font-semibold"
                                                >
                                                    {order.trackingNumber}
                                                </a>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-[13px] text-slate-600 whitespace-nowrap border-r border-b border-slate-200 align-middle">
                                            {order.shippedAt ? format(new Date(order.shippedAt), 'yyyy-MM-dd HH:mm:ss') : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-[13px] text-slate-600 whitespace-nowrap border-b border-slate-200 align-middle">
                                            {order.assignedTo?.name || <span className="text-slate-400">Unassigned</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Table Footer / Pagination */}
                {totalEntries > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t border-border/30 text-sm text-slate-500">
                        <div>
                            Showing {totalEntries === 0 ? 0 : (activePage - 1) * entriesPerPage + 1} to{' '}
                            {Math.min(activePage * entriesPerPage, totalEntries)} of {totalEntries} entries
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 genzo-pager">
                                <button
                                    disabled={activePage === 1}
                                    onClick={() => setCurrentPage(activePage - 1)}
                                    className="px-3 py-1.5 border border-[#ccd2da] rounded text-[13px] text-slate-600 bg-white hover:bg-[#f1f3f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-3 py-1.5 border rounded text-[13px] font-semibold transition-colors cursor-pointer ${
                                            activePage === page
                                                ? 'bg-[#e89c31] text-white border-[#e89c31]'
                                                : 'border-[#ccd2da] bg-white text-slate-600 hover:bg-[#f1f3f5]'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    disabled={activePage === totalPages}
                                    onClick={() => setCurrentPage(activePage + 1)}
                                    className="px-3 py-1.5 border border-[#ccd2da] rounded text-[13px] text-slate-600 bg-white hover:bg-[#f1f3f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
