'use client';

import { useState, useTransition } from 'react';
import { setCreditPrice } from './actions';
import { saBtnPrimary, saError, saHelp, saInput, saLabel, saSuccess } from '../ui';

/**
 * Sets what one credit costs.
 *
 * The panel derives and shows what a delivered order will actually consume,
 * because the credit price and the fee rate are separate knobs and the
 * interesting number is the ratio between them. Moving both together keeps a
 * credit worth one order; moving the fee alone quietly re-prices credit tenants
 * already bought — legitimate, but not something to discover after the fact.
 */
export function CreditPriceForm({
  tenantId,
  currentUnitPrice,
  currentMinimum,
  currency = 'LKR',
  flatFee,
  inheritedFrom,
}: {
  /** Omit for the platform-wide default. */
  tenantId?: string;
  currentUnitPrice?: number;
  currentMinimum?: number;
  currency?: string;
  /** The tenant's flat fee per delivered order, when they have one. */
  flatFee?: number | null;
  inheritedFrom?: 'platform' | null;
}) {
  const [unitPrice, setUnitPrice] = useState(String(currentUnitPrice ?? 75));
  const [minimum, setMinimum] = useState(String(currentMinimum ?? 100));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const price = Number(unitPrice);
  const perOrder = flatFee != null && price > 0 ? Math.round((flatFee / price) * 1e4) / 1e4 : null;
  const minimumCredits = Number(minimum);
  const purchaseCost = Number.isFinite(minimumCredits) && price > 0 ? minimumCredits * price : null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setCreditPrice(formData);
        setSaved(true);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Could not save the credit price.');
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {tenantId && <input type="hidden" name="tenantId" value={tenantId} />}
      <input type="hidden" name="currency" value={currency} />

      {inheritedFrom === 'platform' && (
        <p className={saHelp}>
          This tenant currently uses the platform-wide price. Saving here creates an override that applies to
          them only.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={saLabel} htmlFor="unitPrice">Price per credit ({currency})</label>
          <input
            id="unitPrice"
            name="unitPrice"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            className={saInput}
          />
        </div>
        <div>
          <label className={saLabel} htmlFor="minimumPurchaseCredits">Minimum purchase (credits)</label>
          <input
            id="minimumPurchaseCredits"
            name="minimumPurchaseCredits"
            type="number"
            step="1"
            min="1"
            required
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
            className={saInput}
          />
          <p className={saHelp}>
            {purchaseCost != null
              ? `Smallest top-up: ${currency} ${purchaseCost.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </p>
        </div>
      </div>

      {perOrder != null && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-900">
            One delivered order will consume {perOrder} credit{perOrder === 1 ? '' : 's'}.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {perOrder === 1
              ? 'A credit is worth exactly one shipment, so "100 credits = 100 orders" holds for this tenant.'
              : perOrder > 1
                ? `Tenants holding credit will get about ${Math.round((1 - 1 / perOrder) * 100)}% fewer shipments than when they bought it. Raise the credit price to match the fee if that is not what you intend.`
                : 'Each credit now covers more than one shipment. Lower the credit price to match the fee if that is not what you intend.'}
          </p>
        </div>
      )}

      <div>
        <label className={saLabel} htmlFor="effectiveFrom">Effective from</label>
        <input id="effectiveFrom" name="effectiveFrom" type="datetime-local" className={saInput} />
        <p className={saHelp}>Leave blank to start now. Credit already purchased is never re-valued.</p>
      </div>

      <div>
        <label className={saLabel} htmlFor="note">Note</label>
        <input id="note" name="note" value={note} onChange={(event) => setNote(event.target.value)} className={saInput} />
      </div>

      {error && <p role="alert" className={saError}>{error}</p>}
      {saved && <p className={saSuccess}>Credit price saved.</p>}

      <button type="submit" disabled={pending} className={saBtnPrimary}>
        {pending ? 'Saving…' : 'Save credit price'}
      </button>
    </form>
  );
}
