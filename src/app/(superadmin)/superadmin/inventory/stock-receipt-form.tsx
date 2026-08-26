'use client';

import { useMemo, useState, useTransition } from 'react';
import { recordOwnSupplierStock } from './actions';
import { saBtnPrimary, saCard, saError, saInput, saLabel, saSuccess } from '../ui';

type TenantOption = { id: string; name: string; products: Array<{ id: string; code: string; name: string; stock: number }> };

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
      className={`${saCard} space-y-5 p-5`}
    >
      <div>
        <h2 className="font-bold text-slate-900">Receive stock from tenant&apos;s own supplier</h2>
        <p className="mt-1 text-xs text-slate-500">Only the platform owner can perform this movement. It does not create a platform-store payment.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={saLabel}>Tenant</span>
          <select name="tenantId" value={tenantId} onChange={(event) => setTenantId(event.target.value)} className={`mt-1.5 ${saInput}`} required>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </select>
        </label>
        <label className="block"><span className={saLabel}>Product</span>
          <select name="productId" className={`mt-1.5 ${saInput}`} required key={tenantId}>
            <option value="">Select a product</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name} (current {product.stock})</option>)}
          </select>
        </label>
        <label className="block"><span className={saLabel}>Quantity received</span>
          <input name="quantity" type="number" min="1" max="100000" step="1" className={`mt-1.5 ${saInput}`} required />
        </label>
        <label className="block"><span className={saLabel}>Supplier name</span>
          <input name="supplierName" maxLength={120} className={`mt-1.5 ${saInput}`} required />
        </label>
        <label className="block"><span className={saLabel}>Invoice / reference (optional)</span>
          <input name="reference" maxLength={120} className={`mt-1.5 ${saInput}`} />
        </label>
        <label className="block"><span className={saLabel}>Note (optional)</span>
          <input name="note" maxLength={300} className={`mt-1.5 ${saInput}`} />
        </label>
      </div>
      <div className="border-t border-slate-200 pt-4">
        <button type="submit" disabled={pending || products.length === 0} className={saBtnPrimary}>
          {pending ? 'Recording…' : 'Receive stock'}
        </button>
        {error && <p className={saError}>{error}</p>}
        {done && <p className={saSuccess}>Stock receipt recorded.</p>}
      </div>
    </form>
  );
}
