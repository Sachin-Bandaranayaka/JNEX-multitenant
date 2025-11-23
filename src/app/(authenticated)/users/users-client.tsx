'use client';

import { useState } from 'react';
import { UserList } from '@/components/users/user-list';
import { AddUserButton } from '@/components/users/add-user-button';
import { UserForm } from '@/components/users/user-form';
import { toast } from 'sonner';

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

export function UsersClient({ initialUsers, currentUserId }: { initialUsers: User[], currentUserId: string }) {

    const [users, setUsers] = useState<User[]>(initialUsers);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const handleUserChange = async () => {
        const response = await fetch('/api/users');
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        }
    };

    const openFormForEdit = (user: User) => {
        setEditingUser(user);
        setIsFormOpen(true);
    };

    const openFormForCreate = () => {
        setEditingUser(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete user.');
            }

            toast.success('User deleted successfully.');
            await handleUserChange();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred.');
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Users</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage users and their permissions.</p>
                </div>
                <AddUserButton onAddUser={openFormForCreate} />
            </div>

            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                <UserList
                    users={users}
                    currentUserId={currentUserId}
                    onEdit={openFormForEdit}
                    onDelete={handleDelete}
                />
            </div>

            {/* Modal for Creating/Editing Users */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-3xl border border-border shadow-lg w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                        </div>
                        <div className="p-6">
                            <UserForm
                                user={editingUser}
                                onSuccess={() => {
                                    setIsFormOpen(false);
                                    handleUserChange();
                                }}
                                onCancel={() => setIsFormOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
