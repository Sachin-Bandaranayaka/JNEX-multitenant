'use client';

import { useState } from 'react';
import { User } from 'next-auth';
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import {
  TransExpressLocationPicker,
  type TransExpressLocationValue,
} from '@/components/shipping/trans-express-location-picker';

interface PendingOrder {
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
  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_ORDERS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_ORDERS');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerSecondPhone: order.customerSecondPhone || '',
    customerAddress: order.customerAddress,
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

  const saveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasTransExpress && !shippingLocation) {
      toast.error('Select a district and city before saving.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, shippingLocation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update order');

      onUpdated(order.id, {
        ...form,
        customerSecondPhone: form.customerSecondPhone || null,
        notes: form.notes || null,
        customerCity: shippingLocation?.cityName || order.customerCity,
        shippingLocationProvider: shippingLocation?.provider || order.shippingLocationProvider,
        shippingDistrictId: shippingLocation?.districtId || order.shippingDistrictId,
        shippingDistrictName: shippingLocation?.districtName || order.shippingDistrictName,
        shippingCityId: shippingLocation?.cityId || order.shippingCityId,
        shippingCityName: shippingLocation?.cityName || order.shippingCityName,
      });
      setShowEdit(false);
      toast.success(`Order #${order.number} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update order');
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
            title="Edit confirmed order"
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

      {showEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-order-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 id="edit-order-title" className="text-lg font-bold text-foreground">Edit Order #{order.number}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Update customer and delivery details before shipping.</p>
              </div>
              <button type="button" onClick={() => setShowEdit(false)} disabled={saving} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveOrder} className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Customer name" value={form.customerName} onChange={(value) => setForm({ ...form, customerName: value })} required />
                <Field label="Phone" value={form.customerPhone} onChange={(value) => setForm({ ...form, customerPhone: value })} required />
                <Field label="Second phone" value={form.customerSecondPhone} onChange={(value) => setForm({ ...form, customerSecondPhone: value })} />
                <div className="sm:col-span-2">
                  <Field label="Delivery address" value={form.customerAddress} onChange={(value) => setForm({ ...form, customerAddress: value })} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Notes</label>
                  <textarea
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
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setShowEdit(false)} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-order-title">
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
        </div>
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
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="block w-full rounded-lg border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:ring-primary"
      />
    </div>
  );
}
