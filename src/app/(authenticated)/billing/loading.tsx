export default function BillingLoading() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading billing">
    <h1 className="text-2xl font-bold">Billing</h1>
    <section className="rounded-lg border border-border border-t-4 border-t-primary bg-card p-6">
      <p className="text-sm text-muted-foreground" role="status">Loading your billing summary…</p>
      <div className="mt-4 h-9 w-44 rounded bg-muted motion-safe:animate-pulse" aria-hidden="true" />
    </section>
  </div>;
}
