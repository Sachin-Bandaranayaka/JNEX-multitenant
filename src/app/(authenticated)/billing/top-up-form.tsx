'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Buying shipping credit.
 *
 * The tenant picks a quantity of credits and the form quotes the money, rather
 * than the other way round — they care about how many more orders they can
 * ship, and quoting from the quantity keeps that number exact.
 */
export function TopUpForm({
  minimumCredits,
  unitPrice,
  currency,
}: {
  minimumCredits: number;
  unitPrice: number;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(String(minimumCredits));
  const [form, setForm] = useState({ bankReceiptNumber: '', whatsappNumber: '', transferTime: '' });

  useEffect(() => {
    if (!open) {
      setError(null);
      setCredits(String(minimumCredits));
    }
  }, [open, minimumCredits]);

  const quantity = Number(credits);
  const validQuantity = Number.isFinite(quantity) && quantity >= minimumCredits;
  const amount = validQuantity ? quantity * unitPrice : 0;

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/billing/credits/topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credits: quantity,
          bankReceiptNumber: form.bankReceiptNumber,
          whatsappNumber: form.whatsappNumber,
          transferTime: new Date(form.transferTime).toISOString(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not submit the top-up.');
      setOpen(false);
      setForm({ bankReceiptNumber: '', whatsappNumber: '', transferTime: '' });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the top-up.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Buy credits
      </button>
    );
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="topup-credits">
          How many credits?
        </label>
        <input
          id="topup-credits"
          type="number"
          min={minimumCredits}
          step="1"
          required
          value={credits}
          onChange={(event) => setCredits(event.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Minimum {minimumCredits.toLocaleString('en-LK')} credits.
        </p>
      </div>

      <div className="rounded-md bg-muted/50 p-3">
        <div className="text-sm text-muted-foreground">Transfer this amount</div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {validQuantity
            ? `${currency} ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {currency} {unitPrice.toFixed(2)} per credit
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Transfer the amount above to the platform account, then enter the receipt details. Credits appear once
        the transfer is confirmed.
      </p>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="topup-receipt">
          Bank receipt number
        </label>
        <input id="topup-receipt" required value={form.bankReceiptNumber} onChange={update('bankReceiptNumber')} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="topup-whatsapp">
          WhatsApp number
        </label>
        <input id="topup-whatsapp" required value={form.whatsappNumber} onChange={update('whatsappNumber')} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="topup-time">
          Transfer time
        </label>
        <input id="topup-time" type="datetime-local" required value={form.transferTime} onChange={update('transferTime')} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !validQuantity}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
