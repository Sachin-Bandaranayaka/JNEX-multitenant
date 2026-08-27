'use client';

import { useState, useTransition } from 'react';
import { confirmTopUpAction, rejectTopUpAction } from './actions';
import { saBtnDanger, saBtnGhost, saBtnSuccess, saError, saHelp, saInput, saLabel } from '../ui';

/**
 * Review controls for a credit purchase.
 *
 * Confirming can credit a different quantity than was requested, because the
 * common failure is a tenant transferring slightly the wrong amount. Rejecting
 * that outright makes them start over for no reason; crediting what actually
 * arrived is what a person would do.
 */
export function TopUpReviewForm({
  topUpId,
  requestedCredits,
}: {
  topUpId: string;
  requestedCredits: string;
}) {
  const [mode, setMode] = useState<'idle' | 'confirming' | 'rejecting'>('idle');
  const [credits, setCredits] = useState(requestedCredits);
  const [note, setNote] = useState('');
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

  if (mode === 'rejecting') {
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
              formData.set('topUpId', topUpId);
              formData.set('reason', reason);
              run(rejectTopUpAction, formData);
            }}
            className={saBtnDanger}
          >
            {pending ? 'Rejecting…' : 'Confirm rejection'}
          </button>
          <button type="button" onClick={() => { setMode('idle'); setError(null); }} className={saBtnGhost}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'confirming') {
    return (
      <div className="w-full max-w-sm space-y-3">
        <div>
          <label className={saLabel} htmlFor={`credits-${topUpId}`}>Credits to add</label>
          <input
            id={`credits-${topUpId}`}
            type="number"
            step="0.0001"
            value={credits}
            onChange={(event) => setCredits(event.target.value)}
            className={saInput}
          />
          <p className={saHelp}>
            Requested {requestedCredits}. Change this only if the transfer that arrived was for a different
            amount.
          </p>
        </div>
        <div>
          <label className={saLabel} htmlFor={`note-${topUpId}`}>Note (optional)</label>
          <input id={`note-${topUpId}`} value={note} onChange={(event) => setNote(event.target.value)} className={saInput} />
        </div>
        {error && <p role="alert" className={saError}>{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const formData = new FormData();
              formData.set('topUpId', topUpId);
              formData.set('creditedCredits', credits);
              formData.set('note', note);
              run(confirmTopUpAction, formData);
            }}
            className={saBtnSuccess}
          >
            {pending ? 'Crediting…' : 'Add credits'}
          </button>
          <button type="button" onClick={() => { setMode('idle'); setError(null); }} className={saBtnGhost}>
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
        <button type="button" onClick={() => setMode('confirming')} className={saBtnSuccess}>
          Confirm transfer
        </button>
        <button type="button" onClick={() => setMode('rejecting')} className={saBtnGhost}>
          Reject
        </button>
      </div>
    </div>
  );
}
