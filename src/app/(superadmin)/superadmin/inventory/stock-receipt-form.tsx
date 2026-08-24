'use client';

import { useMemo, useState, useTransition } from 'react';
import { recordOwnSupplierStock } from './actions';

type TenantOption = { id: string; name: string; products: Array<{ id: string; code: string; name: string; stock: number }> };

const inputClass = 'w-full rounded-md border-0 bg-gray-900 p-2 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-500';

export function StockReceiptForm({ tenants }: { tenants: TenantOption[] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const products = useMemo(() => tenants.find((tenant) => tenant.id === tenantId)?.products ?? [], [tenantId, tenants]);

  return (
    <form
      action={(formData) => {
        setError(null);
        setDone(false);
        startTransition(async () => {
          try {
            await recordOwnSupplierStock(formData);
            setDone(true);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not record the stock receipt.');
          }
        });
      }}
      className="space-y-5 rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">Receive stock from tenant&apos;s own supplier</h2>
        <p className="mt-1 text-sm text-gray-400">Only the platform owner can perform this movement. It does not create a platform-store payment.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-gray-300">Tenant
          <select name="tenantId" value={tenantId} onChange={(event) => setTenantId(event.target.value)} className={`mt-1 ${inputClass}`} required>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-300">Product
          <select name="productId" className={`mt-1 ${inputClass}`} required key={tenantId}>
            <option value="">Select a product</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name} (current {product.stock})</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-300">Quantity received
          <input name="quantity" type="number" min="1" max="100000" step="1" className={`mt-1 ${inputClass}`} required />
        </label>
        <label className="text-sm text-gray-300">Supplier name
          <input name="supplierName" maxLength={120} className={`mt-1 ${inputClass}`} required />
        </label>
        <label className="text-sm text-gray-300">Invoice / reference (optional)
          <input name="reference" maxLength={120} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm text-gray-300">Note (optional)
          <input name="note" maxLength={300} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <button type="submit" disabled={pending || products.length === 0} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {pending ? 'Recording…' : 'Receive stock'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {done && <p className="text-sm text-green-400">Stock receipt recorded.</p>}
    </form>
  );
}
