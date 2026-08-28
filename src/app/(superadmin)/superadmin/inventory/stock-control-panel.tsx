'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { controlTenantStock, setLowStockAlert } from './actions';
import { Badge, Card, EmptyState, saBtnDanger, saBtnGhost, saBtnPrimary, saError, saInput, saLabel, saSuccess, saTable, saTd, saTh, saThead, saTr } from '../ui';

export type ControlProduct = {
  id: string;
  code: string;
  name: string;
  stock: number;
  lowStockAlert: number;
  isActive: boolean;
};

export type ControlTenant = { id: string; name: string; products: ControlProduct[] };

type Mode = 'ADD' | 'REMOVE' | 'SET';

const modes: Array<{ value: Mode; label: string; hint: string }> = [
  { value: 'ADD', label: 'Add stock', hint: 'Increase the on-hand quantity by this many units.' },
  { value: 'REMOVE', label: 'Remove stock', hint: 'Decrease the on-hand quantity by this many units.' },
  { value: 'SET', label: 'Set exact stock', hint: 'Overwrite the on-hand quantity with this exact figure.' },
];

export function StockControlPanel({ tenants }: { tenants: ControlTenant[] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ControlProduct | null>(null);

  const tenant = useMemo(() => tenants.find((item) => item.id === tenantId), [tenantId, tenants]);
  const products = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = tenant?.products ?? [];
    if (!term) return list;
    return list.filter((product) => `${product.code} ${product.name}`.toLowerCase().includes(term));
  }, [tenant, query]);

  return (
    <Card
      title="Tenant stock control"
      description="Add, remove, or correct the on-hand quantity of any product in any tenant."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tenantId}
            onChange={(event) => { setTenantId(event.target.value); setEditing(null); }}
            className={saInput}
            aria-label="Tenant"
          >
            {tenants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products…"
            className={saInput}
            aria-label="Search products"
          />
        </div>
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className={saTable}>
          <thead className={saThead}><tr>
            <th className={saTh}>Product</th>
            <th className={`${saTh} text-right`}>On hand</th>
            <th className={`${saTh} text-right`}>Low-stock alert</th>
            <th className={saTh}>Status</th>
            <th className={`${saTh} text-right`}>Control</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200">
            {products.length === 0 && (
              <tr><td colSpan={5} className="p-0">
                <EmptyState
                  title={tenant ? 'No matching products' : 'No tenant selected'}
                  description={tenant ? 'Adjust the search to find a product to control.' : 'Pick a tenant to manage its stock.'}
                />
              </td></tr>
            )}
            {products.map((product) => {
              const isEditing = editing?.id === product.id;
              return (
                <Fragment key={product.id}>
                  <tr className={saTr}>
                    <td className={saTd}>
                      <span className="font-semibold text-slate-900">{product.code}</span> · {product.name}
                    </td>
                    <td className={`${saTd} text-right font-bold tabular-nums ${product.stock === 0 ? 'text-red-700' : product.stock <= product.lowStockAlert ? 'text-amber-700' : 'text-slate-900'}`}>
                      {product.stock}
                    </td>
                    <td className={`${saTd} text-right tabular-nums text-slate-500`}>{product.lowStockAlert}</td>
                    <td className={saTd}>
                      {!product.isActive
                        ? <Badge tone="gray">Archived</Badge>
                        : product.stock === 0
                          ? <Badge tone="red">Out of stock</Badge>
                          : product.stock <= product.lowStockAlert
                            ? <Badge tone="amber">Low</Badge>
                            : <Badge tone="green">In stock</Badge>}
                    </td>
                    <td className={`${saTd} text-right`}>
                      <button
                        type="button"
                        onClick={() => setEditing(isEditing ? null : product)}
                        className={saBtnGhost}
                      >
                        {isEditing ? 'Close' : 'Manage'}
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-4 py-5">
                        <ProductControls
                          tenantId={tenantId}
                          product={product}
                          onDone={() => setEditing(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ProductControls({ tenantId, product, onDone }: { tenantId: string; product: ControlProduct; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('ADD');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertDone, setAlertDone] = useState(false);
  const [alertPending, startAlertTransition] = useTransition();

  const activeMode = modes.find((item) => item.value === mode)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form
        action={(formData) => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await controlTenantStock(formData);
            if (result.ok) {
              setMessage(`Stock moved from ${result.previousStock} to ${result.newStock}.`);
            } else {
              setError(result.message);
            }
          });
        }}
        className="space-y-4"
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="mode" value={mode} />

        <div className="flex flex-wrap gap-2">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => { setMode(item.value); setError(null); setMessage(null); }}
              className={mode === item.value ? saBtnPrimary : saBtnGhost}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{activeMode.hint} Current on-hand: <span className="font-semibold tabular-nums text-slate-700">{product.stock}</span>.</p>

        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <label className="block"><span className={saLabel}>{mode === 'SET' ? 'New stock level' : 'Quantity'}</span>
            <input
              name="quantity"
              type="number"
              min={mode === 'SET' ? 0 : 1}
              max={1000000}
              step={1}
              defaultValue={mode === 'SET' ? product.stock : 1}
              key={mode}
              className={`mt-1.5 ${saInput}`}
              required
            />
          </label>
          <label className="block"><span className={saLabel}>Reason</span>
            <input name="reason" maxLength={300} placeholder="Damaged units written off, recount, transfer…" className={`mt-1.5 ${saInput}`} required />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={mode === 'REMOVE' ? saBtnDanger : saBtnPrimary}>
            {pending ? 'Applying…' : activeMode.label}
          </button>
          <button type="button" onClick={onDone} className={saBtnGhost}>Done</button>
        </div>
        {error && <p className={saError}>{error}</p>}
        {message && <p className={saSuccess}>{message}</p>}
      </form>

      <form
        action={(formData) => {
          setAlertError(null);
          setAlertDone(false);
          startAlertTransition(async () => {
            const result = await setLowStockAlert(formData);
            if (result.ok) setAlertDone(true);
            else setAlertError(result.message);
          });
        }}
        className="space-y-4 border-t border-slate-200 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="productId" value={product.id} />
        <label className="block"><span className={saLabel}>Low-stock alert threshold</span>
          <input name="lowStockAlert" type="number" min={0} max={100000} step={1} defaultValue={product.lowStockAlert} className={`mt-1.5 ${saInput}`} required />
        </label>
        <p className="text-xs text-slate-500">The tenant is warned once on-hand stock drops to this level.</p>
        <button type="submit" disabled={alertPending} className={saBtnGhost}>
          {alertPending ? 'Saving…' : 'Save threshold'}
        </button>
        {alertError && <p className={saError}>{alertError}</p>}
        {alertDone && <p className={saSuccess}>Threshold updated.</p>}
      </form>
    </div>
  );
}
