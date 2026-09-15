'use client';

export default function BillingError({ reset }: { reset: () => void }) {
  return <section className="rounded-lg border border-border bg-card p-6" role="alert">
    <h1 className="text-xl font-semibold">Billing is temporarily unavailable</h1>
    <p className="mt-2 text-sm text-muted-foreground">We couldn’t load your billing information. Please try again.</p>
    <button onClick={reset} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
  </section>;
}
