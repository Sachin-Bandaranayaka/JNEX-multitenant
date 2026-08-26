'use client';

import { useState, useTransition } from 'react';
import { setTenantRate } from '../actions';
import { computeFee, type FeeModelName, type FeeTier } from '@/lib/billing/compute-fee';
import { saBtnPrimary, saCard, saError, saInput, saLabel, saSuccess } from '../../ui';

const inputClass = `mt-1.5 ${saInput}`;
const labelClass = saLabel;

function parseTierText(raw: string): FeeTier[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [bound, amount] = line.split(':').map((part) => part.trim());
      const isOpen = bound === '' || bound === '*' || bound.toLowerCase() === 'rest';
      return { upTo: isOpen ? null : Number(bound), amount: Number(amount) };
    });
}

/**
 * Creating a rate never edits the old one — it closes it and opens a new
 * version — so the form is deliberately phrased as "new rate", not "edit".
 */
export function RateForm({ tenantId, currency }: { tenantId: string; currency: string }) {
  const [feeModel, setFeeModel] = useState<FeeModelName>('FLAT_PER_ORDER');
  const [flatAmount, setFlatAmount] = useState('');
  const [percentDisplay, setPercentDisplay] = useState('');
  const [tiers, setTiers] = useState('500: 50\n: 40');
  const [minFee, setMinFee] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // Live preview of what one order would cost, so a mistyped rate is obvious
  // before it is in force.
  let preview: string | null = null;
  try {
    const sample = computeFee({
      rate: {
        feeModel,
        flatAmount: flatAmount === '' ? null : Number(flatAmount),
        percentRate: percentDisplay === '' ? null : Number(percentDisplay) / 100,
        tiers: feeModel === 'TIERED_BY_VOLUME' ? parseTierText(tiers) : null,
        minFee: minFee === '' ? null : Number(minFee),
        maxFee: maxFee === '' ? null : Number(maxFee),
      },
      orderTotal: 5000,
      periodSequence: 1,
    });
    preview = `${currency} ${sample.toFixed(2)}`;
  } catch {
    preview = null;
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setDone(false);
        startTransition(async () => {
          try {
            await setTenantRate(formData);
            setDone(true);
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Could not save the rate.');
          }
        });
      }}
      className={`${saCard} space-y-5 p-5`}
    >
      <input type="hidden" name="tenantId" value={tenantId} />

      <div>
        <h2 className="font-bold text-slate-900">New rate</h2>
        <p className="mt-1 text-xs text-slate-500">
          Saving closes the current rate and starts this one. Charges already recorded keep their original terms.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="feeModel">Fee model</label>
          <select
            id="feeModel"
            name="feeModel"
            value={feeModel}
            onChange={(event) => setFeeModel(event.target.value as FeeModelName)}
            className={inputClass}
          >
            <option value="FLAT_PER_ORDER">Flat per delivered order</option>
            <option value="PERCENT_OF_ORDER">Percentage of order value</option>
            <option value="TIERED_BY_VOLUME">Tiered by monthly volume</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="currency">Currency</label>
          <input id="currency" name="currency" defaultValue={currency} className={inputClass} />
        </div>

        {feeModel === 'FLAT_PER_ORDER' && (
          <div>
            <label className={labelClass} htmlFor="flatAmount">Fee per delivered order</label>
            <input
              id="flatAmount"
              name="flatAmount"
              type="number"
              step="0.01"
              min="0"
              value={flatAmount}
              onChange={(event) => setFlatAmount(event.target.value)}
              placeholder="50.00"
              className={inputClass}
            />
          </div>
        )}

        {feeModel === 'PERCENT_OF_ORDER' && (
          <div>
            <label className={labelClass} htmlFor="percentDisplay">Percentage of order value</label>
            <input
              id="percentDisplay"
              name="percentDisplay"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percentDisplay}
              onChange={(event) => setPercentDisplay(event.target.value)}
              placeholder="2.5"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">Entered as a percentage — 2.5 means 2.5%.</p>
          </div>
        )}

        {feeModel === 'TIERED_BY_VOLUME' && (
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="tiers">Volume tiers</label>
            <textarea
              id="tiers"
              name="tiers"
              rows={4}
              value={tiers}
              onChange={(event) => setTiers(event.target.value)}
              className={`${inputClass} font-mono`}
            />
            <p className="mt-1 text-xs text-slate-500">
              One tier per line as <code>up-to: fee</code>. The last line must have a blank bound — it covers
              everything above. Example: <code>500: 50</code> then <code>: 40</code> charges Rs. 50 for the
              first 500 deliveries in a month and Rs. 40 after that.
            </p>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="minFee">Minimum fee (optional)</label>
          <input
            id="minFee" name="minFee" type="number" step="0.01" min="0"
            value={minFee} onChange={(event) => setMinFee(event.target.value)} className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="maxFee">Maximum fee (optional)</label>
          <input
            id="maxFee" name="maxFee" type="number" step="0.01" min="0"
            value={maxFee} onChange={(event) => setMaxFee(event.target.value)} className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="effectiveFrom">Effective from (optional)</label>
          <input id="effectiveFrom" name="effectiveFrom" type="datetime-local" className={inputClass} />
          <p className="mt-1 text-xs text-slate-500">Defaults to now. Must be after the current rate started.</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="note">Note (optional)</label>
          <input id="note" name="note" placeholder="Agreed on the Aug call" className={inputClass} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className={saBtnPrimary}
        >
          {pending ? 'Saving…' : 'Put this rate in force'}
        </button>
        {preview && (
          <span className="text-sm text-slate-600">
            An order worth {currency} 5,000.00 would be charged <span className="font-bold text-slate-900">{preview}</span>
          </span>
        )}
      </div>

      {error && <p role="alert" className={saError}>{error}</p>}
      {done && <p className={saSuccess}>Rate saved and now in force.</p>}
    </form>
  );
}
