'use client';

import { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { ZodError } from 'zod';
import { calculateOrderPricing } from '@/lib/order-pricing';
import { User } from 'next-auth';
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import {
  TransExpressLocationPicker,
  type TransExpressLocationValue,
} from '@/components/shipping/trans-express-location-picker';

export interface PendingOrder {
  productId?: string; quantity?: number; total?: number; discount?: number; unitPrice?: number | null; deliveryFee?: number | null; prepaidAmount?: number | null; codAmount?: number | null; userId?: string; customerEmail?: string | null;
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  customerSecondPhone: string | null;
  customerAddress: string;
  customerCity: string;
  notes: string | null;
  shippingLocationProvider: string | null;
  shippingDistrictId: number | null;
  shippingDistrictName: string | null;
  shippingCityId: number | null;
  shippingCityName: string | null;
}

export function PendingOrderActions({
  order,
  user,
  hasTransExpress,
  onUpdated,
  onDeleted,
}: {
  order: PendingOrder;
  user: User;
  hasTransExpress: boolean;
  onUpdated: (orderId: string, updates: Record<string, unknown>) => void;
  onDeleted: (orderId: string) => void;
}) {
  const notesId = useId();
  const [showEdit, setShowEdit] = useState(false);
  const router = useRouter();
  const [editPricing, setEditPricing] = useState(false);
  const [pricing, setPricing] = useState({ productId: order.productId || '', quantity: String(order.quantity || 1), unitPrice: order.unitPrice == null ? '' : String(order.unitPrice), discount: String(order.discount || 0), deliveryFee: order.deliveryFee == null ? '' : String(order.deliveryFee), prepaidAmount: order.prepaidAmount == null ? '' : String(order.prepaidAmount) });
  const [options, setOptions] = useState<{products: Array<{id:string;name:string;code:string;price:number}>, staff:Array<{id:string;name:string|null}>}>({products:[],staff:[]});
  const [optionsError, setOptionsError] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [assignedUserId, setAssignedUserId] = useState(order.userId || '');
  const [saveError, setSaveError] = useState<string|null>(null);
  useEffect(() => {
    if (!showEdit) return;
    const controller = new AbortController(); setOptionsLoading(true); setOptionsError(false);
    fetch('/api/orders/edit-options', {signal:controller.signal,cache:'no-store'}).then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); if (!controller.signal.aborted) setOptions(data); }).catch(() => { if (!controller.signal.aborted) setOptionsError(true); }).finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, [showEdit,retry]);
  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_ORDERS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_ORDERS');
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    customerName: order.customerName || '',
    customerEmail: order.customerEmail || '',
    customerCity: order.customerCity || '',
    customerPhone: order.customerPhone || '',
    customerSecondPhone: order.customerSecondPhone || '',
    customerAddress: order.customerAddress || '',
    notes: order.notes || '',
  });
  const initialLocation = order.shippingLocationProvider === 'TRANS_EXPRESS'
    && order.shippingDistrictId
    && order.shippingDistrictName
    && order.shippingCityId
    && order.shippingCityName
    ? {
        provider: 'TRANS_EXPRESS' as const,
        districtId: order.shippingDistrictId,
        districtName: order.shippingDistrictName,
        cityId: order.shippingCityId,
        cityName: order.shippingCityName,
      }
    : undefined;
  const [shippingLocation, setShippingLocation] = useState<TransExpressLocationValue | undefined>(initialLocation);

  useEffect(() => {
    if (showEdit) {
      setEditPricing(false); setSaveError(null); setAssignedUserId(order.userId || '');
      setPricing({ productId: order.productId || '', quantity: String(order.quantity || 1), unitPrice: order.unitPrice == null ? '' : String(order.unitPrice), discount: String(order.discount || 0), deliveryFee: order.deliveryFee == null ? '' : String(order.deliveryFee), prepaidAmount: order.prepaidAmount == null ? '' : String(order.prepaidAmount) });
      setForm({
        customerName: order.customerName || '',
    customerEmail: order.customerEmail || '',
    customerCity: order.customerCity || '',
        customerPhone: order.customerPhone || '',
        customerSecondPhone: order.customerSecondPhone || '',
        customerAddress: order.customerAddress || '',
        notes: order.notes || '',
      });
      setShippingLocation(
        order.shippingLocationProvider === 'TRANS_EXPRESS'
          && order.shippingDistrictId
          && order.shippingDistrictName
          && order.shippingCityId
          && order.shippingCityName
          ? {
              provider: 'TRANS_EXPRESS' as const,
              districtId: order.shippingDistrictId,
              districtName: order.shippingDistrictName,
              cityId: order.shippingCityId,
              cityName: order.shippingCityName,
            }
          : undefined
      );
    }
  }, [showEdit, order]);

  const saveOrder = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true); setSaveError(null);
    try {
      if (editPricing && (optionsLoading || optionsError)) throw new Error('Load product options before changing pricing.');
      if (editPricing && ['quantity','unitPrice','deliveryFee','prepaidAmount','discount'].some(key => pricing[key as keyof typeof pricing].trim() === '')) throw new Error('Enter each pricing amount explicitly, including zero where agreed.');
      const pricingUpdate = editPricing ? calculateOrderPricing({ ...pricing, quantity:Number(pricing.quantity), unitPrice:Number(pricing.unitPrice), discount:Number(pricing.discount), deliveryFee:Number(pricing.deliveryFee), prepaidAmount:Number(pricing.prepaidAmount) }) : undefined;
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, shippingLocation, ...(pricingUpdate ? { pricing: pricingUpdate } : {}), ...(user.role === 'ADMIN' && assignedUserId !== order.userId ? { assignedUserId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update order');

      onUpdated(order.id, {
        ...result,
        ...form,
        customerSecondPhone: form.customerSecondPhone || null,
        notes: form.notes || null,
        customerCity: shippingLocation?.cityName || form.customerCity,
        shippingLocationProvider: shippingLocation?.provider || order.shippingLocationProvider,
        shippingDistrictId: shippingLocation?.districtId || order.shippingDistrictId,
        shippingDistrictName: shippingLocation?.districtName || order.shippingDistrictName,
        shippingCityId: shippingLocation?.cityId || order.shippingCityId,
        shippingCityName: shippingLocation?.cityName || order.shippingCityName,
      });
      setShowEdit(false);
      router.refresh();
      toast.success(`Order #${order.number} updated.`);
    } catch (error) {
      const message = error instanceof ZodError
        ? error.issues.map(issue => `${issue.path.length ? `${String(issue.path[0]).replace(/([A-Z])/g, ' $1')}: ` : ''}${issue.message}`).join(' ')
        : error instanceof Error ? error.message : 'Failed to update order';
      setSaveError(message); toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteOrder = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete order');
      onDeleted(order.id);
      setShowDelete(false);
      toast.success(`Order #${order.number} deleted from Pending Orders and stock restored.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            title="Edit order before shipment"
            aria-label={`Edit order #${order.number}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            title="Delete confirmed order"
            aria-label={`Delete order #${order.number}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <Dialog open={showEdit} onClose={() => !saving && setShowEdit(false)} className="relative z-[60]">
        <div className="jnex-themed fixed inset-0 flex items-center justify-center bg-slate-950/60 p-4">
          <Dialog.Panel className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <Dialog.Title id="edit-order-title" className="text-lg font-bold text-foreground">Edit Order #{order.number}</Dialog.Title>
                <p className="mt-0.5 text-xs text-muted-foreground">Update customer and delivery details before shipping.</p>
              </div>
              <button type="button" aria-label="Close order editor" onClick={() => setShowEdit(false)} disabled={saving} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveOrder} className="space-y-5 p-6">
              {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
              <fieldset disabled={saving} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Customer name" value={form.customerName} onChange={(value) => setForm({ ...form, customerName: value })} required />
                <Field label="Phone" value={form.customerPhone} onChange={(value) => setForm({ ...form, customerPhone: value })} required />
                <Field label="Email" value={form.customerEmail} onChange={(value) => setForm({ ...form, customerEmail:value })} />
                <Field label="City" value={form.customerCity} onChange={(value) => setForm({ ...form, customerCity:value })} />
                <Field label="Second phone" value={form.customerSecondPhone} onChange={(value) => setForm({ ...form, customerSecondPhone: value })} />
                <div className="sm:col-span-2">
                  <Field label="Delivery address" value={form.customerAddress} onChange={(value) => setForm({ ...form, customerAddress: value })} required />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={notesId} className="mb-1.5 block text-sm font-medium text-muted-foreground">Notes</label>
                  <textarea
                    id={notesId}
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    rows={3}
                    className="block w-full rounded-lg border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                {hasTransExpress && (
                  <TransExpressLocationPicker
                    value={shippingLocation}
                    onChange={setShippingLocation}
                    suggestedCity={order.shippingCityName || order.customerCity}
                    disabled={saving}
                  />
                )}
              </fieldset>
              {optionsError && <div role="alert" className="text-sm text-destructive">Product and staff options could not be loaded. <button type="button" onClick={() => setRetry(value => value+1)} className="underline">Retry</button></div>}
              {user.role === 'ADMIN' && <label className="block text-sm text-muted-foreground">Assigned staff<select disabled={saving || optionsLoading || optionsError} value={assignedUserId} onChange={event => setAssignedUserId(event.target.value)} className="mt-1 block w-full rounded-md border-border bg-background">{!options.staff.some(person=>person.id===assignedUserId) && <option value={assignedUserId}>Current assigned staff</option>}{options.staff.map(person => <option key={person.id} value={person.id}>{person.name || 'Unnamed staff'}</option>)}</select></label>}
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground"><input type="checkbox" disabled={saving} checked={editPricing} onChange={event=>setEditPricing(event.target.checked)} />Edit product and pricing</label>
              {!editPricing && <p className="text-xs text-muted-foreground">Contact-only edits preserve the saved financial amounts.</p>}
              {editPricing && <fieldset disabled={saving || optionsLoading || optionsError} className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
                <p className="text-xs text-muted-foreground sm:col-span-2">Enter the agreed prices, delivery fee and prepayment explicitly. Missing historical amounts are left blank.</p>
                <label className="text-sm text-muted-foreground sm:col-span-2">Product<select required value={pricing.productId} onChange={event=>setPricing({...pricing,productId:event.target.value})} className="mt-1 block w-full rounded-md border-border bg-background"><option value="">Choose product</option>{options.products.map(product=><option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></label>
                {(['quantity','unitPrice','discount','deliveryFee','prepaidAmount'] as const).map(key=><label key={key} className="text-sm text-muted-foreground">{{quantity:'Quantity',unitPrice:'Agreed unit price (LKR)',discount:'Discount (LKR)',deliveryFee:'Delivery fee (LKR)',prepaidAmount:'Prepaid amount (LKR)'}[key]}<input required type="number" min={key==='quantity'?1:0} step={key==='quantity'?1:0.01} value={pricing[key]} onChange={event=>setPricing({...pricing,[key]:event.target.value})} className="mt-1 block w-full rounded-md border-border bg-background" /></label>)}
                <button type="button" onClick={()=>{const product=options.products.find(item=>item.id===pricing.productId);if(product)setPricing({...pricing,unitPrice:String(product.price)});}} className="text-left text-xs text-primary underline">Use current catalog unit price</button>
              </fieldset>}
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setShowEdit(false)} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving || (editPricing && (optionsLoading || optionsError))} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {showDelete && createPortal(
        <div className="jnex-themed fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-order-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 id="delete-order-title" className="text-lg font-bold text-foreground">Delete Order #{order.number}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes the order from Pending Orders and restores {order.customerName}&apos;s reserved stock. A cancellation record is kept for reports and auditing.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowDelete(false)} disabled={deleting} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Keep order</button>
              <button type="button" onClick={deleteOrder} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete order'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</label>
      <input id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="block w-full rounded-lg border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:ring-primary"
      />
    </div>
  );
}
