'use client';
export default function SuperAdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="rounded-md border border-red-200 bg-white p-8 text-center shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Control centre error</p><h2 className="mt-2 text-xl font-bold">This information could not be loaded</h2><p className="mt-2 text-sm text-slate-600">No action was taken. Try loading the page again.</p><button onClick={reset} className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Try again</button></div>;
}
