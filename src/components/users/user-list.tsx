'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { PencilIcon, TrashIcon, UserIcon, EnvelopeIcon, CalendarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'TEAM_MEMBER' | 'SUPER_ADMIN';
  createdAt: string;
  totalOrders: number;
  totalLeads: number;
  permissions: string[];
}

interface UserListProps {
  users: User[];
  currentUserId: string;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
}

export function UserList({ users, currentUserId, onEdit, onDelete }: UserListProps) {
  const getRoleBadgeColor = (role: 'ADMIN' | 'TEAM_MEMBER' | 'SUPER_ADMIN') => {
    switch (role) {
      case 'ADMIN':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20';
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
      default:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    }
  };

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="bg-muted/50 rounded-full p-4 mb-4">
          <UserIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground">No users found</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new user.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
      {users.map((user, index) => (
        <motion.div
          key={user.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group relative bg-card hover:bg-accent/5 rounded-3xl border border-border p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h3 className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                  {user.name || 'No name'}
                </h3>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                  {user.role === 'TEAM_MEMBER' ? 'Team Member' : user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(user)}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                aria-label="Edit user"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(user.id)}
                disabled={user.id === currentUserId}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Delete user"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="h-4 w-4" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span>Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="h-4 w-4" />
              <span>{user.permissions.length} Permissions</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-sm">
            <div className="text-center">
              <div className="font-semibold text-foreground">{user.totalOrders}</div>
              <div className="text-xs text-muted-foreground">Orders</div>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <div className="text-center">
              <div className="font-semibold text-foreground">{user.totalLeads}</div>
              <div className="text-xs text-muted-foreground">Leads</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
