'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ArrowRightIcon, ArrowsRightLeftIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Card, EmptyState, saBtnGhost, saBtnPrimary, saInput, saLabel } from '../ui';
import { transferTenant } from './actions';
import type { HierarchyTenant, TransferHistoryItem } from './types';

type Node = HierarchyTenant & { children: Node[]; level: number; downlineCount: number };

function makeForest(tenants: HierarchyTenant[]) {
  const byId = new Map(tenants.map((tenant) => [tenant.id, { ...tenant, children: [], level: 0, downlineCount: 0 } as Node]));
  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.referredById ? byId.get(node.referredById) : null;
    if (parent && parent.id !== node.id) parent.children.push(node); else roots.push(node);
  }
  for (const node of byId.values()) node.children.sort((a, b) => a.name.localeCompare(b.name));
  roots.sort((a, b) => a.name.localeCompare(b.name));
  const visited = new Set<string>();
  const measure = (node: Node, level: number, path: Set<string>): number => {
    if (path.has(node.id)) { node.children = []; return 0; }
    visited.add(node.id); node.level = level;
    const nextPath = new Set(path).add(node.id);
    node.downlineCount = node.children.reduce((total, child) => total + 1 + measure(child, level + 1, nextPath), 0);
    return node.downlineCount;
  };
  for (const root of roots) measure(root, 0, new Set());
  // Keep malformed legacy records visible instead of silently dropping a cycle.
  for (const node of byId.values()) if (!visited.has(node.id)) { node.referredById = null; roots.push(node); measure(node, 0, new Set()); }
  return { roots, byId };
}

export function HierarchyWorkspace({ tenants, history }: { tenants: HierarchyTenant[]; history: TransferHistoryItem[] }) {
  const router = useRouter();
  const { roots, byId } = useMemo(() => makeForest(tenants), [tenants]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map((root) => root.id)));
  const [moving, setMoving] = useState<Node | null>(null);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const normalized = query.trim().toLocaleLowerCase();
  const matches = (node: Node): boolean => {
    const ownStatus = status === 'all' || (status === 'active' ? node.isActive : !node.isActive);
    const ownText = !normalized || `${node.name} ${node.businessName || ''}`.toLocaleLowerCase().includes(normalized);
    return (ownStatus && ownText) || node.children.some(matches);
  };
  const filtering = Boolean(normalized) || status !== 'all';
  const visibleRoots = roots.filter(matches);
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const expandAll = () => setExpanded(new Set(tenants.map((tenant) => tenant.id)));
  const collapseAll = () => setExpanded(new Set());

  return <>
    {notice && <div role="status" className={`flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm font-semibold ${notice.tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}><span>{notice.text}</span><button onClick={() => setNotice(null)} className="rounded p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current" aria-label="Dismiss message"><XMarkIcon className="h-4 w-4" /></button></div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
      <Card flush title="Partner portfolios" description="Expand a branch to follow its referral line." actions={<div className="flex gap-1"><button type="button" onClick={expandAll} className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-red-500">Expand all</button><span className="text-slate-300">/</span><button type="button" onClick={collapseAll} className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-red-500">Collapse</button></div>}>
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_170px]">
          <label className="relative"><span className="sr-only">Search tenants</span><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${saInput} py-2 pl-10`} placeholder="Search member or business…" /></label>
          <label><span className="sr-only">Filter tenant status</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={`${saInput} py-2`}><option value="all">All statuses</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></label>
        </div>
        {visibleRoots.length ? <div className="space-y-4 p-3 sm:p-4">{visibleRoots.map((root) => <Branch key={root.id} node={root} isRoot expanded={expanded} filtering={filtering} searchQuery={normalized} matches={matches} onToggle={toggle} onTransfer={setMoving} />)}</div> : <EmptyState title="No tenants match" description="Try another name or status filter." />}
      </Card>
      <Card flush title="Recent transfers" description="Latest 10 recorded branch changes." className="xl:sticky xl:top-5">
        {history.length ? <ol className="divide-y divide-slate-200">{history.map((item) => <li key={item.id} className="p-4"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-slate-300 bg-slate-50 text-slate-500"><ArrowsRightLeftIcon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-bold text-slate-900">{item.memberName}</p><p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-600"><span>{item.fromName || 'Top level'}</span><ArrowRightIcon className="h-3 w-3" /><span className="font-semibold text-slate-900">{item.toName || 'Top level'}</span></p><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500" title={item.reason || undefined}>{item.reason || 'No reason recorded'}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))} · {item.actorName}</p></div></div></li>)}</ol> : <EmptyState title="No transfers yet" description="Completed transfers will form an append-only record here." />}
      </Card>
    </div>
    <TransferDialog member={moving} tenants={tenants} byId={byId} onClose={() => setMoving(null)} onComplete={(result) => { setMoving(null); setNotice(result); router.refresh(); }} />
  </>;
}

function Branch({ node, isRoot = false, expanded, filtering, searchQuery, matches, onToggle, onTransfer }: { node: Node; isRoot?: boolean; expanded: Set<string>; filtering: boolean; searchQuery: string; matches: (node: Node) => boolean; onToggle: (id: string) => void; onTransfer: (node: Node) => void }) {
  const open = filtering || expanded.has(node.id);
  const isDirectSearchMatch = Boolean(searchQuery) && `${node.name} ${node.businessName || ''}`.toLocaleLowerCase().includes(searchQuery);
  return <article className={isRoot ? 'border border-slate-300 bg-[#fffdf8]' : ''}>
    {isRoot && <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-red-50/60 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c50500]">Root partner · {node.downlineCount + 1} member portfolio</p><UserGroupIcon className="h-4 w-4 text-red-400" /></header>}
    <div className={`group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 border-l-[3px] px-2 py-3 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-3 ${isDirectSearchMatch ? 'bg-amber-50 ring-1 ring-inset ring-amber-300 hover:bg-amber-50' : 'hover:bg-slate-50'} ${node.isActive ? 'border-l-emerald-600' : 'border-l-red-600'} ${!isRoot ? 'border-b border-slate-200' : ''}`}>
      <button type="button" onClick={() => onToggle(node.id)} disabled={!node.children.length} aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`} aria-expanded={node.children.length ? open : undefined} className="mt-0.5 rounded p-1 text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-20 sm:mt-0">{open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}</button>
      <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><h3 className="min-w-0 break-words text-sm font-bold text-slate-950">{node.name}</h3><span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${node.isActive ? 'text-emerald-700' : 'text-red-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${node.isActive ? 'bg-emerald-600' : 'bg-red-600'}`} />{node.isActive ? 'Active' : 'Inactive'}</span></div><p className="mt-0.5 truncate text-xs text-slate-500" title={node.businessName || undefined}>{node.businessName || 'No business name'}</p><dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:mt-1"><div><dt className="inline">Level </dt><dd className="inline tabular-nums text-slate-900">{node.level}</dd></div><div><dt className="inline">Direct </dt><dd className="inline tabular-nums text-slate-900">{node.children.length}</dd></div><div><dt className="inline">Downline </dt><dd className="inline tabular-nums text-slate-900">{node.downlineCount}</dd></div></dl></div>
      <button type="button" onClick={() => onTransfer(node)} className="col-start-2 mt-1 w-fit rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-red-300 hover:text-[#c50500] focus:outline-none focus:ring-2 focus:ring-red-500 sm:col-start-3 sm:row-start-1 sm:mt-0">Transfer</button>
    </div>
    {node.children.length > 0 && open && <div className={`${isRoot ? 'ml-3 sm:ml-5' : 'ml-2 sm:ml-4'} border-l border-slate-300 pl-2 sm:pl-3`}>{node.children.filter(matches).map((child) => <Branch key={child.id} node={child} expanded={expanded} filtering={filtering} searchQuery={searchQuery} matches={matches} onToggle={onToggle} onTransfer={onTransfer} />)}</div>}
  </article>;
}

function TransferDialog({ member, tenants, byId, onClose, onComplete }: { member: Node | null; tenants: HierarchyTenant[]; byId: Map<string, Node>; onClose: () => void; onComplete: (notice: { tone: 'good' | 'bad'; text: string }) => void }) {
  const [candidateQuery, setCandidateQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  if (!member) return null;
  const descendantIds = new Set<string>(); const stack = [...member.children]; while (stack.length) { const item = stack.pop()!; if (descendantIds.has(item.id)) continue; descendantIds.add(item.id); stack.push(...item.children); }
  const current = member.referredById ? byId.get(member.referredById) : null;
  const candidates = tenants.filter((tenant) => `${tenant.name} ${tenant.businessName || ''}`.toLocaleLowerCase().includes(candidateQuery.toLocaleLowerCase())).slice(0, 30);
  const resetClose = () => { if (pending) return; setCandidateQuery(''); setSelectedId(''); setReason(''); setConfirmed(false); setError(''); onClose(); };
  const submit = () => { setError(''); if (!selectedId) return setError('Select a new direct referrer.'); if (!confirmed) return setError('Confirm that you understand the branch impact.'); startTransition(async () => { const result = await transferTenant({ memberId: member.id, newReferrerId: selectedId === '__root__' ? null : selectedId, reason }); if (result.ok) { setCandidateQuery(''); setSelectedId(''); setReason(''); setConfirmed(false); onComplete({ tone: 'good', text: result.message }); } else setError(result.message); }); };
  return <Dialog open={Boolean(member)} onClose={resetClose} className="relative z-50"><DialogBackdrop transition className="fixed inset-0 bg-slate-950/45 transition-opacity data-[closed]:opacity-0" /><div className="fixed inset-0 overflow-y-auto p-3 sm:p-6"><div className="flex min-h-full items-end justify-center sm:items-center"><DialogPanel transition className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl transform flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-2xl transition data-[closed]:translate-y-3 data-[closed]:opacity-0 sm:max-h-[calc(100dvh-3rem)]">
    <div className="relative shrink-0 border-b border-slate-200 bg-slate-950 p-5 pr-14 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">Branch transfer</p><DialogTitle className="mt-1 text-xl font-bold">Move {member.name}</DialogTitle><p className="mt-2 text-sm text-slate-300">Current direct referrer: <strong className="text-white">{current?.name || 'No referrer / top level'}</strong></p><button onClick={resetClose} disabled={pending} aria-label="Close transfer dialog" className="absolute right-4 top-4 rounded p-2 text-slate-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-red-500"><XMarkIcon className="h-5 w-5" /></button></div>
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm leading-6 text-amber-950"><strong>Entire branch moves:</strong> {member.downlineCount ? `${member.downlineCount} downline member${member.downlineCount === 1 ? '' : 's'} will follow ${member.name}.` : 'This member has no downline.'} Future referrals and commissions use the new branch. Existing orders and historic business stay with their original period.</div>
    <div className="min-h-0 space-y-5 overflow-y-auto p-5"><fieldset><legend className={saLabel}>New direct referrer</legend><div className="relative mt-2"><MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Search possible referrers…" className={`${saInput} py-2 pl-9`} /></div><div className="mt-2 max-h-52 overflow-y-auto border border-slate-300" role="radiogroup" aria-label="New direct referrer"><Candidate id="__root__" name="No referrer / top-level partner" detail="Make this tenant a root portfolio" selected={selectedId === '__root__'} disabled={!member.referredById} disabledReason={!member.referredById ? 'Current position' : undefined} onSelect={setSelectedId} />{candidates.map((tenant) => { const disabledReason = tenant.id === member.id ? 'This member' : descendantIds.has(tenant.id) ? 'In this downline' : !tenant.isActive ? 'Inactive' : tenant.id === member.referredById ? 'Current referrer' : undefined; return <Candidate key={tenant.id} id={tenant.id} name={tenant.name} detail={tenant.businessName || 'No business name'} selected={selectedId === tenant.id} disabled={Boolean(disabledReason)} disabledReason={disabledReason} onSelect={setSelectedId} />; })}</div></fieldset>
      <label className="block"><span className={saLabel}>Reason for transfer <span className="text-red-600">*</span></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} maxLength={500} rows={3} className={`mt-2 ${saInput}`} placeholder="Example: Partner portfolio reassigned following territory review" /><span className="mt-1 block text-xs text-slate-500">Required and stored permanently in the audit record.</span></label>
      <label className="flex items-start gap-3 border border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 rounded border-slate-400 text-[#e10600] focus:ring-red-500" /><span>I confirm that this member and their entire downline should move to the selected branch.</span></label>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_20px_-16px_rgba(15,23,42,0.6)] sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><button type="button" disabled={pending} onClick={resetClose} className={saBtnGhost}>Cancel</button><button type="button" disabled={pending || reason.trim().length < 10 || !confirmed || !selectedId} onClick={submit} className={saBtnPrimary}>{pending ? 'Transferring branch…' : 'Confirm branch transfer'}</button></div>
    </div>
  </DialogPanel></div></div></Dialog>;
}

function Candidate({ id, name, detail, selected, disabled, disabledReason, onSelect }: { id: string; name: string; detail: string; selected: boolean; disabled: boolean; disabledReason?: string; onSelect: (id: string) => void }) {
  return <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={() => onSelect(id)} className={`flex w-full items-center gap-3 border-b border-slate-200 px-3 py-2.5 text-left last:border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500 ${selected ? 'bg-red-50' : 'hover:bg-slate-50'} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-55`}><span className={`h-4 w-4 shrink-0 rounded-full border-[5px] ${selected ? 'border-[#e10600]' : 'border-slate-300'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{name}</span><span className="block truncate text-xs text-slate-500">{detail}</span></span>{disabledReason && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{disabledReason}</span>}</button>;
}
