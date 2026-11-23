'use client';

import { useState, useTransition } from 'react';
import { adjustCreditsAction, setCreditPolicy } from './actions';
import { saBtnDark, saBtnPrimary, saError, saHelp, saInput, saLabel, saSuccess } from '../ui';

/**
 * How a tenant pays: monthly invoice, or prepaid credit with a floor.
 *
 * Switching to prepaid is the moment the platform's exposure to a tenant drops
 * to a single order's fee, so the copy here is about consequences rather than
 * field names.
 */
export function CreditPolicyForm({
  tenantId,
  billingMode,
  creditLimitCredits,
  minimumShipCredits,
  lowBalanceCredits,
  hasCreditPrice,
}: {
  tenantId: string;
  billingMode: 'POSTPAID' | 'PREPAID';
  creditLimitCredits: number;
  minimumShipCredits: number | null;
  lowBalanceCredits: number | null;
  hasCreditPrice: boolean;
}) {
  const [mode, setMode] = useState(billingMode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await setCreditPolicy(formData);
        setSaved(true);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Could not save the policy.');
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="tenantId" value={tenantId} />

      <div>
        <label className={saLabel} htmlFor="billingMode">Billing mode</label>
        <select
          id="billingMode"
          name="billingMode"
          value={mode}
          onChange={(event) => setMode(event.target.value as 'POSTPAID' | 'PREPAID')}
          className={saInput}
        >
          <option value="POSTPAID">Postpaid — invoiced monthly after delivery</option>
          <option value="PREPAID">Prepaid — must hold credit to ship</option>
        </select>
        <p className={saHelp}>
          {mode === 'PREPAID'
            ? 'Credit is reserved when an order ships and charged when it delivers, so this tenant can never owe more than one order at a time.'
            : 'Fees accrue through the month and are invoiced on the 1st. Nothing stops this tenant shipping.'}
        </p>
      </div>

      {mode === 'PREPAID' && !hasCreditPrice && (
        <p role="alert" className={saError}>
          No credit price resolves for this tenant. Set a platform-wide price or an override before switching
          them to prepaid.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={saLabel} htmlFor="creditLimitCredits">Overdraft allowance</label>
          <input
            id="creditLimitCredits"
            name="creditLimitCredits"
            type="number"
            step="1"
            min="0"
            defaultValue={creditLimitCredits}
            className={saInput}
          />
          <p className={saHelp}>Credits this tenant may go into the red. 0 means no credit, no shipping.</p>
        </div>
        <div>
          <label className={saLabel} htmlFor="minimumShipCredits">Minimum to ship</label>
          <input
            id="minimumShipCredits"
            name="minimumShipCredits"
            type="number"
            step="1"
            defaultValue={minimumShipCredits ?? ''}
            className={saInput}
          />
          <p className={saHelp}>Overrides the overdraft allowance when set. Usually left blank.</p>
        </div>
        <div>
          <label className={saLabel} htmlFor="lowBalanceCredits">Low balance warning</label>
          <input
            id="lowBalanceCredits"
            name="lowBalanceCredits"
            type="number"
            step="1"
            defaultValue={lowBalanceCredits ?? ''}
            className={saInput}
          />
          <p className={saHelp}>Notifies the tenant once when they drop below this.</p>
        </div>
      </div>

      {error && <p role="alert" className={saError}>{error}</p>}
      {saved && <p className={saSuccess}>Policy saved.</p>}

      <button type="submit" disabled={pending} className={saBtnPrimary}>
        {pending ? 'Saving…' : 'Save policy'}
      </button>
    </form>
  );
}

/** Manual wallet correction. Always requires a reason — the ledger is evidence. */
export function AdjustCreditsForm({ tenantId, balance }: { tenantId: string; balance: number }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');

  const parsed = Number(amount);
  const validAmount = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
  const signed = validAmount ? (direction === 'remove' ? -parsed : parsed) : 0;
  const after = Math.round((balance + signed) * 1e4) / 1e4;
  const fmt = (value: number) => value.toLocaleString('en-LK', { maximumFractionDigits: 4 });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setSaved(null);
    startTransition(async () => {
      try {
        await adjustCreditsAction(formData);
        setSaved(`${direction === 'remove' ? 'Removed' : 'Added'} ${fmt(Math.abs(signed))} credit(s).`);
        form.reset();
        setAmount('');
        setDirection('add');
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Could not post the adjustment.');
      }
    });
  };

  const toggle = (value: 'add' | 'remove', label: string) => (
    <button
      type="button"
      onClick={() => setDirection(value)}
      aria-pressed={direction === value}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
        direction === value
          ? value === 'remove'
            ? 'bg-red-600 text-white'
            : 'bg-emerald-600 text-white'
          : 'bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <span className={saLabel}>Action</span>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1" role="group" aria-label="Adjustment direction">
            {toggle('add', 'Add credits')}
            {toggle('remove', 'Remove credits')}
          </div>
        </div>
        <div>
          <label className={saLabel} htmlFor="adjust-credits">Credits</label>
          <input
            id="adjust-credits"
            name="credits"
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0.0001"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={saInput}
          />
          <p className={saHelp}>
            Balance {fmt(balance)} →{' '}
            <span className={after < 0 ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
              {fmt(after)}
            </span>
          </p>
        </div>
        <div>
          <label className={saLabel} htmlFor="adjust-reason">Reason</label>
          <input id="adjust-reason" name="reason" required className={saInput} />
          <p className={saHelp}>Shown on the ledger and recorded against your account.</p>
        </div>
      </div>

      {error && <p role="alert" className={saError}>{error}</p>}
      {saved && <p className={saSuccess}>{saved}</p>}

      <button type="submit" disabled={pending || !validAmount} className={saBtnDark}>
        {pending
          ? 'Posting…'
          : validAmount
            ? `${direction === 'remove' ? 'Remove' : 'Add'} ${fmt(parsed)} credit(s)`
            : 'Post adjustment'}
      </button>
    </form>
  );
}
