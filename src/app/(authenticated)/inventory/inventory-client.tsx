'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog } from '@headlessui/react';
import { User } from 'next-auth';
import { ProductForm } from '@/components/products/product-form';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Product { id: string; code: string; name: string; description?: string | null; price: number; stock: number; lowStockAlert: number; totalOrders: number; totalLeads: number; lastStockUpdate: string }
interface StockAdjustment { id: string; quantity: number; reason: string; previousStock: number; newStock: number; createdAt: string; adjustedBy?: { name: string | null; email: string } }
const money = (value: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);
const dates = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });
const stockStatus = (product: Product) => product.stock <= 0 ? 'out' : product.stock <= product.lowStockAlert ? 'low' : 'healthy';
const statusText = { out: 'Out of stock', low: 'Low stock', healthy: 'Healthy' };
const control = 'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
const action = 'rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

export function InventoryClient({ initialProducts, user }: { initialProducts: Product[]; user: User }) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
    const [history, setHistory] = useState<StockAdjustment[]>([]);
    const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [historyRetry, setHistoryRetry] = useState(0);
    const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_PRODUCTS');
    const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_PRODUCTS');
    const filtered = useMemo(() => initialProducts.filter(product => {
        const term = query.trim().toLocaleLowerCase();
        return (!term || `${product.code} ${product.name}`.toLocaleLowerCase().includes(term)) && (status === 'all' || stockStatus(product) === status) && (minPrice === '' || product.price >= Number(minPrice)) && (maxPrice === '' || product.price <= Number(maxPrice));
    }), [initialProducts, query, status, minPrice, maxPrice]);

    useEffect(() => {
        if (!historyProduct) return;
        const controller = new AbortController();
        setHistoryState('loading');
        setHistory([]);
        const load = async () => {
            try {
                const response = await fetch(`/api/inventory/${historyProduct.id}/history`, { signal: controller.signal, cache: 'no-store' });
                if (!response.ok) throw new Error('Unable to load history');
                const data = await response.json();
                if (!Array.isArray(data)) throw new Error('Invalid history');
                if (!controller.signal.aborted) { setHistory(data); setHistoryState('ready'); }
            } catch { if (!controller.signal.aborted) setHistoryState('error'); }
        };
        load();
        return () => controller.abort();
    }, [historyProduct, historyRetry]);

    const createProduct = async (data: Parameters<React.ComponentProps<typeof ProductForm>['onSubmit']>[0]) => {
        setBusy(true);
        try {
            const response = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Failed to create product'); }
            setShowCreate(false);
            router.refresh();
        } finally { setBusy(false); }
    };
    const importProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        setBusy(true); setError(null);
        try {
            const data = new FormData(); data.append('file', file);
            const response = await fetch('/api/products/import', { method: 'POST', body: data });
            if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Failed to import products'); }
            router.refresh();
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to import products'); }
        finally { setBusy(false); input.value = ''; }
    };
    const deactivate = async (product: Product) => {
        if (!confirm(`Deactivate ${product.name}? It will be hidden from active lists, while its data and history are preserved.`)) return;
        setBusy(true); setError(null);
        try {
            const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
            if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Failed to deactivate product'); }
            router.refresh();
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to deactivate product'); }
        finally { setBusy(false); }
    };

    return <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-foreground">Stock List</h1><p className="mt-1 text-sm text-muted-foreground">Manage products, prices, stock visibility, and recorded movements.</p></div>{canEdit && <div className="flex flex-wrap gap-2"><label className={`${action} cursor-pointer focus-within:ring-2 focus-within:ring-primary`}>{busy ? 'Please wait…' : 'Import CSV'}<input aria-label="Import products CSV" type="file" accept=".csv" className="sr-only" disabled={busy} onChange={importProducts} /></label><button disabled={busy} onClick={() => setShowCreate(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Add Product</button></div>}</header>
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {showCreate && <section className="rounded-xl border border-border bg-card"><h2 className="border-b border-border px-6 py-4 font-semibold text-foreground">Add product</h2><ProductForm user={user} onSubmit={createProduct} onCancel={() => !busy && setShowCreate(false)} /></section>}
        <section aria-label="Stock filters" className="rounded-xl border border-border bg-card p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-medium text-muted-foreground">Name or code<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products" className={control} /></label><label className="text-xs font-medium text-muted-foreground">Stock status<select value={status} onChange={event => setStatus(event.target.value)} className={control}><option value="all">All stock</option><option value="healthy">Healthy</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></label><label className="text-xs font-medium text-muted-foreground">Minimum price (LKR)<input type="number" min="0" step="0.01" value={minPrice} onChange={event => setMinPrice(event.target.value)} className={control} /></label><label className="text-xs font-medium text-muted-foreground">Maximum price (LKR)<input type="number" min="0" step="0.01" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} className={control} /></label></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground" aria-live="polite">{filtered.length} of {initialProducts.length} products · {filtered.reduce((sum, product) => sum + product.stock, 0).toLocaleString()} stock units</p><button onClick={() => { setQuery(''); setStatus('all'); setMinPrice(''); setMaxPrice(''); }} className={action}>Clear filters</button></div></section>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">{filtered.length === 0 ? <div className="px-6 py-14 text-center"><h2 className="font-semibold text-foreground">{initialProducts.length ? 'No matching products' : 'No active products'}</h2><p className="mt-2 text-sm text-muted-foreground">{initialProducts.length ? 'Adjust or clear the filters to see more products.' : canEdit ? 'Add a product or import a CSV to get started.' : 'Active products will appear here when available.'}</p></div> : <table className="w-full min-w-[1000px] text-sm"><caption className="sr-only">Active stock and product records</caption><thead className="bg-muted/40"><tr>{['Code / product', 'Unit price', 'Stock', 'Status', 'Alert threshold', 'Orders / leads', 'Last update', 'Actions'].map(label => <th key={label} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{filtered.map(product => <tr key={product.id} className="hover:bg-muted/20"><td className="max-w-xs px-4 py-3"><span className="block font-semibold text-foreground">{product.name}</span><span className="text-xs font-mono text-muted-foreground">{product.code}</span>{product.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={product.description}>{product.description}</p>}</td><td className="whitespace-nowrap px-4 py-3 text-foreground">{money(product.price)}</td><td className="px-4 py-3 font-semibold tabular-nums text-foreground">{product.stock}</td><td className="px-4 py-3"><span className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${stockStatus(product) === 'out' ? 'bg-destructive/10 text-destructive' : stockStatus(product) === 'low' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>{statusText[stockStatus(product)]}</span></td><td className="px-4 py-3 text-muted-foreground">{product.lowStockAlert}</td><td className="px-4 py-3 text-foreground">{product.totalOrders} / {product.totalLeads}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{dates.format(new Date(product.lastStockUpdate))}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => setHistoryProduct(product)} className={action} aria-label={`View stock history for ${product.name}`}>History</button>{canEdit && <Link href={`/products/${product.id}/edit`} className={action}>Edit</Link>}{canDelete && <button disabled={busy} onClick={() => deactivate(product)} className={`${action} text-destructive`}>Deactivate</button>}</div></td></tr>)}</tbody></table>}</div>
        <Dialog open={Boolean(historyProduct)} onClose={() => setHistoryProduct(null)} className="relative z-50"><div className="fixed inset-0 bg-black/50" aria-hidden="true" /><div className="fixed inset-0 overflow-y-auto p-4"><div className="flex min-h-full items-center justify-center"><Dialog.Panel className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><Dialog.Title className="font-semibold text-foreground">Stock history · {historyProduct?.name}</Dialog.Title><p className="mt-1 text-xs text-muted-foreground">Recorded movements · Sri Lanka time</p></div><button aria-label="Close stock history" onClick={() => setHistoryProduct(null)} className={action}><XMarkIcon className="h-4 w-4" /></button></div>{historyState === 'loading' ? <p role="status" className="py-10 text-sm text-muted-foreground">Loading history…</p> : historyState === 'error' ? <div role="alert" className="py-6"><p className="mb-3 text-sm text-destructive">Stock history could not be loaded.</p><button onClick={() => setHistoryRetry(value => value + 1)} className={action}>Retry</button></div> : history.length === 0 ? <p className="py-10 text-sm text-muted-foreground">No stock movements recorded for this product.</p> : <ol className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto">{history.map(item => <li key={item.id} className="rounded-md border border-border p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong className="text-foreground">{item.quantity > 0 ? '+' : ''}{item.quantity} units</strong><time dateTime={new Date(item.createdAt).toISOString()} className="text-xs text-muted-foreground">{dates.format(new Date(item.createdAt))}</time></div><p className="mt-2 break-words text-sm text-foreground">{item.reason}</p><p className="mt-2 text-xs text-muted-foreground">Stock: {item.previousStock} → {item.newStock} · {item.adjustedBy?.name || 'Staff not recorded'}</p></li>)}</ol>}</Dialog.Panel></div></div></Dialog>
    </div>;
}
