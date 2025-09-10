'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

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

// --- FIX: Update props to handle actions ---
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
        return 'bg-indigo-900/50 text-indigo-300 ring-indigo-900/50';
      case 'SUPER_ADMIN':
        return 'bg-purple-900/50 text-purple-300 ring-purple-900/50';
      default:
        return 'bg-green-900/50 text-green-300 ring-green-900/50';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead>
          <tr>
            <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[200px] leading-tight">
              User
            </th>
            <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[120px] leading-tight">
              Role
            </th>
            <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider min-w-[140px] leading-tight">
              Activity
            </th>
            <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[120px]">
              Joined
            </th>
            <th scope="col" className="relative px-4 py-3 sm:px-6 min-w-[100px]">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {users.map((user, index) => (
            <motion.tr
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="hover:bg-gray-700/50 transition-colors duration-200 touch-manipulation"
            >
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                <div className="text-base sm:text-sm font-medium text-white truncate">
                  {user.name || 'No name'}
                </div>
                <div className="text-base sm:text-sm text-gray-400 truncate">
                  {user.email}
                </div>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold leading-5 ${getRoleBadgeColor(user.role)}`}>
                  {user.role === 'TEAM_MEMBER' ? 'Team Member' : user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                </span>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-base sm:text-sm text-gray-100">
                <div className="flex flex-col sm:flex-row sm:gap-1">
                  <span>{user.totalOrders} orders</span>
                  <span className="hidden sm:inline">,</span>
                  <span>{user.totalLeads} leads</span>
                </div>
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-base sm:text-sm text-gray-100">
                {format(new Date(user.createdAt), 'MMM d, yyyy')}
              </td>
              <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-3">
                  <button 
                    onClick={() => onEdit(user)} 
                    className="text-indigo-400 hover:text-indigo-300 transition-colors p-2 touch-manipulation"
                    aria-label="Edit user"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => onDelete(user.id)} 
                    disabled={user.id === currentUserId}
                    className="text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors p-2 touch-manipulation"
                    aria-label="Delete user"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 sm:px-6 text-center text-gray-400">
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
