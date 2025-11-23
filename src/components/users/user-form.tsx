'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { Role } from '@prisma/client';
import { CheckIcon } from '@heroicons/react/24/outline';

const permissionsList = [
  "VIEW_DASHBOARD", "VIEW_PRODUCTS", "EDIT_PRODUCTS", "DELETE_PRODUCTS",
  "EDIT_STOCK_LEVELS", "VIEW_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS",
  "VIEW_ORDERS", "CREATE_ORDERS", "EDIT_ORDERS", "DELETE_ORDERS",
  "VIEW_SHIPPING", "UPDATE_SHIPPING_STATUS", "VIEW_REPORTS", "EXPORT_REPORTS",
  "MANAGE_USERS", "MANAGE_SETTINGS"
];

const userSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(Role),
  password: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  permissions: string[];
}

interface UserFormProps {
  user: User | null; // null for creating, user object for editing
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, control, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      role: user?.role || Role.TEAM_MEMBER,
      permissions: user?.permissions || [],
    },
  });

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);
    const apiEndpoint = user ? `/api/users/${user.id}` : '/api/users';
    const method = user ? 'PUT' : 'POST';

    try {
      const response = await fetch(apiEndpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${user ? 'update' : 'create'} user.`);
      }

      toast.success(`User ${user ? 'updated' : 'created'} successfully!`);
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

      {/* Password field (only for new users) */}
      {!user && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">Password</label>
          <input
            type="password"
            id="password"
            {...register('password')}
            className="block w-full rounded-xl border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-2"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
        </div>
      )}

      {/* Role Selector */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1">Role</label>
        <select
          id="role"
          {...register('role')}
          className="block w-full rounded-xl border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-2"
        >
          <option value={Role.ADMIN}>Admin</option>
          <option value={Role.TEAM_MEMBER}>Team Member</option>
        </select>
      </div>

      {/* Permissions Checkboxes */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Permissions</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-4 bg-muted/30 rounded-2xl border border-border">
          {permissionsList.map(permission => (
            <div key={permission} className="flex items-start">
              <Controller
                name="permissions"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      id={permission}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={field.value?.includes(permission)}
                      onChange={(e) => {
                        const newPermissions = e.target.checked
                          ? [...(field.value || []), permission]
                          : (field.value || []).filter(p => p !== permission);
                        field.onChange(newPermissions);
                      }}
                    />
                  </div>
                )}
              />
              <label htmlFor={permission} className="ml-3 text-xs text-muted-foreground select-none cursor-pointer">
                {permission.replace(/_/g, ' ')}
              </label>
            </div>
          ))}
        </div>
      </div>

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
