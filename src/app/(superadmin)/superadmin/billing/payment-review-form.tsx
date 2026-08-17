'use client';

import { useState, useTransition } from 'react';
import { confirmPayment, rejectPayment } from './actions';

/**
 * Confirm/reject controls for a submitted bank transfer. Rejection asks for a
 * reason inline because the tenant sees it — a bare "rejected" leaves them with
 * nothing to act on.
 */
export function PaymentReviewForm({ paymentId }: { paymentId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (formData: FormData) => Promise<void>, formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
      }
    });
  };

  if (rejecting) {
    return (
      <div className="w-full max-w-sm space-y-2">
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="Why is this transfer being rejected?"
          className="w-full rounded-md border-0 bg-gray-900 p-2 text-sm text-white ring-1 ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const formData = new FormData();
              formData.set('paymentId', paymentId);
              formData.set('reason', reason);
              run(rejectPayment, formData);
            }}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {pending ? 'Rejecting…' : 'Confirm rejection'}
          </button>
          <button
            type="button"
            onClick={() => { setRejecting(false); setError(null); }}
            className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-right">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const formData = new FormData();
            formData.set('paymentId', paymentId);
            run(confirmPayment, formData);
          }}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {pending ? 'Confirming…' : 'Confirm payment'}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
