// Shared design-language pieces for the Super Admin console.
//
// The console shell is a light surface (`bg-[#f5f4f0]`), so pages must not
// carry the old dark-panel styling — white-on-cream text is what made several
// of these screens unreadable. Everything below matches the overview,
// tenant-directory, and audit pages, which are the reference for this look.

import Link from 'next/link';

export const brand = '#e10600';

export const saCard = 'rounded-md border border-slate-300 bg-white shadow-sm';
export const saCardPad = `${saCard} p-5`;
export const saDivider = 'divide-y divide-slate-200';

export const saBtnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-[#e10600] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#ba0500] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const saBtnDark =
  'inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export const saBtnGhost =
  'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition-colors hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';
export const saBtnDanger =
  'inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50';
export const saBtnSuccess =
  'inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const saInput =
  'block w-full rounded-md border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:ring-red-500';
export const saLabel = 'block text-sm font-bold text-slate-700';
export const saHelp = 'mt-1 text-xs text-slate-500';
export const saError = 'mt-2 text-sm font-semibold text-red-700';
export const saSuccess = 'mt-2 text-sm font-semibold text-emerald-700';

export const saTable = 'min-w-full divide-y divide-slate-200';
export const saThead = 'bg-slate-50';
export const saTh =
  'whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500';
export const saTd = 'px-4 py-3 text-sm text-slate-700';
export const saTr = 'hover:bg-slate-50';

export const saTone = {
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-blue-50 text-blue-800',
  violet: 'bg-violet-50 text-violet-700',
  gray: 'bg-slate-100 text-slate-700',
} as const;

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof saTone; children: React.ReactNode }) {
  return <span className={`inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${saTone[tone]}`}>{children}</span>;
}

/** The standard page masthead: red eyebrow, title, supporting line, optional action. */
export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = 'Back',
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
          <span aria-hidden>←</span>
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-end">
        <div>
          {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e10600]">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

/** A titled white panel. Pass `flush` when the body is a table or a divided list. */
export function Card({
  title,
  description,
  actions,
  flush,
  className = '',
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${saCard} overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            {title && <h2 className="font-bold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

/** A single KPI figure. `tone` colours the number, not the tile. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    default: 'text-slate-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
  }[tone];
  return (
    <div className={`${saCard} p-5`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="font-bold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
