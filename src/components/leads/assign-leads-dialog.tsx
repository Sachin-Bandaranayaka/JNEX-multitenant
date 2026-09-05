'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'TEAM_MEMBER' | 'SUPER_ADMIN';
  isActive: boolean;
};

/// Hands the selected leads to a member of staff. Admin-only, so it is only
/// ever rendered for an admin -- the endpoint enforces the same thing.
export function AssignLeadsDialog({
  leadIds,
  onClose,
  onAssigned,
}: {
  leadIds: string[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/users', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load staff');
        const data: StaffMember[] = await response.json();
        if (active) setStaff(data.filter(member => member.isActive));
      } catch {
        if (active) {
          setStaff([]);
          toast.error('Could not load the staff list.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds,
          // The empty choice means "take it off everyone's list".
          userId: selected === '' ? null : selected,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to assign leads.');

      const who =
        selected === ''
          ? 'unassigned'
          : `assigned to ${staff?.find(m => m.id === selected)?.name || 'that staff member'}`;
      toast.success(
        data.assigned === 0
          ? 'Those leads were already where you wanted them.'
          : `${data.assigned} lead(s) ${who}.`,
      );
      onAssigned();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign leads.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Assign leads</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {leadIds.length} lead{leadIds.length === 1 ? '' : 's'} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label htmlFor="assignee" className="mb-1 block text-sm font-medium text-foreground">
              Assign to
            </label>
            {staff === null ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading staff...
              </div>
            ) : (
              <select
                id="assignee"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="block w-full rounded-xl border-border bg-background px-4 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:ring-primary"
              >
                <option value="">Nobody (leave unassigned)</option>
                {staff.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                    {member.role === 'ADMIN' ? ' (Admin)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <UserIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              The new owner sees these leads in their own list, and any reminder still
              waiting on them moves across too.
            </span>
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-border p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving || staff === null}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
