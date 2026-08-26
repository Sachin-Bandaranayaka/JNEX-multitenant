'use client';

import { useState, useTransition } from 'react';
import { confirmPayment, rejectPayment } from './actions';
import { saBtnDanger, saBtnGhost, saBtnSuccess, saError, saInput } from '../ui';

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
          className={saInput}
        />
        {error && <p role="alert" className={saError}>{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const formData = new FormData();
              formData.set('paymentId', paymentId);
              formData.set('reason', reason);
              run(rejectPayment, formData);
            }}
            className={saBtnDanger}
          >
            {pending ? 'Rejecting…' : 'Confirm rejection'}
          </button>
          <button
            type="button"
            onClick={() => { setRejecting(false); setError(null); }}
            className={saBtnGhost}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-right">
      {error && <p role="alert" className={saError}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const formData = new FormData();
            formData.set('paymentId', paymentId);
            run(confirmPayment, formData);
          }}
          className={saBtnSuccess}
        >
          {pending ? 'Confirming…' : 'Confirm payment'}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          className={saBtnGhost}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
