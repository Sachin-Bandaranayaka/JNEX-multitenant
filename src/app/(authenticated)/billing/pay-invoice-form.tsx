'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bank-transfer settlement, same shape as the store checkout the tenants
 * already know: they transfer, then submit the receipt for review.
 */
export function PayInvoiceForm({
  invoiceId,
  amountDue,
  currency,
}: {
  invoiceId: string;
  amountDue: string;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    bankReceiptNumber: '',
    whatsappNumber: '',
    transferTime: '',
    amount: amountDue,
  });

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/billing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          bankReceiptNumber: form.bankReceiptNumber,
          whatsappNumber: form.whatsappNumber,
          transferTime: new Date(form.transferTime).toISOString(),
          amount: Number(form.amount),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not submit the payment.');
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the payment.');
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
        Submit payment
      </button>
    );
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Transfer {currency} {amountDue} to the platform account, then enter the receipt details below.
      </p>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor={`receipt-${invoiceId}`}>
          Bank receipt number
        </label>
        <input
          id={`receipt-${invoiceId}`}
          required
          value={form.bankReceiptNumber}
          onChange={update('bankReceiptNumber')}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor={`whatsapp-${invoiceId}`}>
          WhatsApp number
        </label>
        <input
          id={`whatsapp-${invoiceId}`}
          required
          value={form.whatsappNumber}
          onChange={update('whatsappNumber')}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor={`time-${invoiceId}`}>
          Transfer time
        </label>
        <input
          id={`time-${invoiceId}`}
          type="datetime-local"
          required
          value={form.transferTime}
          onChange={update('transferTime')}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor={`amount-${invoiceId}`}>
          Amount transferred ({currency})
        </label>
        <input
          id={`amount-${invoiceId}`}
          type="number"
          step="0.01"
          readOnly
          required
          value={form.amount}
          className={`${inputClass} bg-muted`}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
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
