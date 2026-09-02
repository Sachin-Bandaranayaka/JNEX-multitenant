'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { Role } from '@prisma/client';
import { CheckIcon } from '@heroicons/react/24/outline';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  PERMISSIONS,
  can,
  type Permission,
} from '@/lib/permissions';
import { PASSWORD_RULE_TEXT, validatePassword } from '@/lib/password-policy';

const baseSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum([Role.ADMIN, Role.TEAM_MEMBER]),
  password: z.string().optional(),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  isActive: z.boolean().optional(),
});

/// A new account always needs a password; an existing one only validates the
/// field when the admin actually typed a replacement. The API applies the same
/// rule, this just means the person sees the problem next to the field.
function schemaFor(isEditing: boolean) {
  return baseSchema.superRefine((values, ctx) => {
    const password = values.password?.trim();
    if (!isEditing && !password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: `Password is required (${PASSWORD_RULE_TEXT.toLowerCase()})`,
      });
      return;
    }
    if (password) {
      const problem = validatePassword(password);
      if (problem) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: problem });
      }
    }
  });
}

type UserFormData = z.infer<typeof baseSchema>;

interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  permissions: string[];
  isActive?: boolean;
}

interface UserFormProps {
  user: User | null; // null for creating, user object for editing
  /// The person doing the editing: a delegate with MANAGE_USERS can only hand
  /// out access they hold themselves, and cannot touch admin accounts. The API
  /// enforces this; the form simply stops offering what would be refused.
  actor: { id: string; role: Role; permissions: string[] };
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, actor, onSuccess, onCancel }: UserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = Boolean(user);
  const actorIsAdmin = actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;
  const isSelf = user?.id === actor.id;

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(schemaFor(isEditing)),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      role: (user?.role === Role.ADMIN ? Role.ADMIN : Role.TEAM_MEMBER),
      permissions: (user?.permissions || []).filter((p): p is Permission =>
        (PERMISSIONS as readonly string[]).includes(p),
      ),
      password: '',
      isActive: user?.isActive ?? true,
    },
  });

  const selectedRole = watch('role');

  const canGrant = (permission: Permission) => actorIsAdmin || can(actor, permission);

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);
    const apiEndpoint = user ? `/api/users/${user.id}` : '/api/users';
    const method = user ? 'PUT' : 'POST';
    const password = data.password?.trim();

    try {
      const response = await fetch(apiEndpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          // An empty password field on an edit means "leave it alone".
          password: password || undefined,
          permissions: data.permissions ?? [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${user ? 'update' : 'create'} user.`);
      }

      toast.success(`Staff account ${user ? 'updated' : 'created'} successfully!`);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name and Email fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Full Name</label>
          <input
            type="text"
            id="name"
            {...register('name')}
            className="block w-full rounded-xl border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-2"
            placeholder="John Doe"
          />
          {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email Address</label>
          <input
            type="email"
            id="email"
            {...register('email')}
            className="block w-full rounded-xl border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-2"
            placeholder="john@example.com"
          />
          {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
        </div>
      </div>

      {/* Password: required when creating, optional reset when editing */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          {isEditing ? 'Reset password' : 'Password'}
        </label>
        <input
          type="password"
          id="password"
          autoComplete="new-password"
          {...register('password')}
          className="block w-full rounded-xl border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-2"
          placeholder={isEditing ? 'Leave blank to keep the current password' : '••••••••'}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {isEditing
            ? `Setting a new password signs this person out everywhere. ${PASSWORD_RULE_TEXT}`
            : PASSWORD_RULE_TEXT}
        </p>
        {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
      </div>

      {/* Role Selector */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1">Role</label>
        {/* Editing yourself: the role is shown but not editable, and the real
            value still travels with the form so the update is a no-op change
            rather than a missing field. */}
        {isSelf ? (
          <>
            <input type="hidden" {...register('role')} />
            <div className="block w-full rounded-xl border border-border bg-muted/40 text-muted-foreground sm:text-sm px-4 py-2">
              {user?.role === Role.ADMIN ? 'Admin' : 'Team Member'}
            </div>
          </>
        ) : (
          <select
            id="role"
            {...register('role')}
            className="block w-full rounded-xl border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-2"
          >
            {/* Only an admin can create or edit another admin. */}
            {actorIsAdmin && <option value={Role.ADMIN}>Admin</option>}
            <option value={Role.TEAM_MEMBER}>Team Member</option>
          </select>
        )}
        {isSelf && (
          <p className="text-xs text-muted-foreground mt-1">You cannot change your own role or access.</p>
        )}
      </div>

      {/* Account status, when editing someone else */}
      {isEditing && !isSelf && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isActive"
            {...register('isActive')}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="isActive" className="text-sm text-foreground select-none cursor-pointer">
            Account is active (inactive staff cannot sign in)
          </label>
        </div>
      )}

      {/* Permissions Checkboxes */}
      {selectedRole === Role.ADMIN ? (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-2xl border border-border p-4">
          Admins have full access to the business, so there is nothing to tick here.
        </p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Permissions</label>
          <div className="space-y-4 max-h-72 overflow-y-auto p-4 bg-muted/30 rounded-2xl border border-border">
            {PERMISSION_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.permissions.map(permission => (
                    <Controller
                      key={permission}
                      name="permissions"
                      control={control}
                      render={({ field }) => {
                        const grantable = canGrant(permission) && !isSelf;
                        return (
                          <label
                            htmlFor={permission}
                            className={`flex items-start gap-3 ${grantable ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                          >
                            <input
                              type="checkbox"
                              id={permission}
                              disabled={!grantable}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              checked={field.value?.includes(permission) ?? false}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...(field.value || []), permission]
                                  : (field.value || []).filter(p => p !== permission);
                                field.onChange(next);
                              }}
                            />
                            <span className="text-xs text-muted-foreground select-none">
                              {PERMISSION_LABELS[permission]}
                            </span>
                          </label>
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!actorIsAdmin && (
            <p className="text-xs text-muted-foreground mt-2">
              You can only grant access that you hold yourself.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-full text-foreground bg-muted hover:bg-muted/80 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4" />
              {user ? 'Update User' : 'Create User'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
