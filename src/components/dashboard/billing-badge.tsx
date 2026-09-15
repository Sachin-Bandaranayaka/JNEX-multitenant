'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Summary = { billingMode: 'POSTPAID' } | { billingMode: 'PREPAID'; available: number; held: number; spendable: number };
const credits = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 });

export function BillingBadge({ billingMode }: { billingMode: string }) {
    const pathname = usePathname();
    const [summary, setSummary] = useState<Summary | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (billingMode !== 'PREPAID') return;
        let active = true;
        let controller: AbortController | null = null;
        const refresh = async () => {
            controller?.abort();
            const request = new AbortController();
            controller = request;
            try {
                const response = await fetch('/api/billing/summary', { cache: 'no-store', signal: request.signal });
                if (!response.ok) throw new Error('Unable to load credits');
                const data = await response.json();
                if (data.billingMode !== 'POSTPAID' && (data.billingMode !== 'PREPAID' || ![data.available, data.held, data.spendable].every(value => typeof value === 'number' && Number.isFinite(value)))) throw new Error('Invalid credit summary');
                if (active && !request.signal.aborted) {
                    setSummary(data);
                    setFailed(false);
                }
            } catch {
                if (active && !request.signal.aborted) {
                    setFailed(true);
                    setSummary(null);
                }
            }
        };
        refresh();
        const interval = window.setInterval(refresh, 60_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('jnex:billing-updated', refresh);
        return () => {
            active = false;
            controller?.abort();
            window.clearInterval(interval);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('jnex:billing-updated', refresh);
        };
    }, [billingMode, pathname]);

    const prepaid = billingMode === 'PREPAID' && summary?.billingMode !== 'POSTPAID';
    const wallet = prepaid && summary?.billingMode === 'PREPAID' ? summary : null;
    const low = Boolean(wallet && (wallet.available <= 0 || wallet.spendable <= 0));
    const text = !prepaid ? 'Billing' : failed ? 'Check credits' : wallet ? `${credits.format(wallet.available)} credits${low ? ' · Low balance' : ''}` : 'Loading credits…';
    const description = !prepaid ? 'Open billing' : failed ? 'Credit balance could not be refreshed. Open billing to check your current balance.' : wallet ? `${credits.format(wallet.available)} available credits; ${credits.format(wallet.held)} reserved credits; ${credits.format(wallet.spendable)} spendable credits including any credit allowance. Open billing.` : 'Loading your available credit balance. Open billing.';
    return (
        <Link href="/billing" title={description} aria-label={description} className={`inline-flex min-w-0 max-w-full items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181c] ${low ? 'border-amber-300/50 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20' : 'border-white/20 bg-white/5 text-white hover:bg-white/10'}`}>
            <span className="break-words" aria-live="polite">{text}</span>
        </Link>
    );
}
