'use client';

import { useState } from 'react';
import { UserList } from '@/components/users/user-list';
import { AddUserButton } from '@/components/users/add-user-button';
import { UserForm } from '@/components/users/user-form';
import { toast } from 'sonner';
import { Role } from '@prisma/client';

interface User {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    createdAt: string;
    totalOrders: number;
    totalLeads: number;
    permissions: string[];
    isActive: boolean;
}

export function UsersClient({
    initialUsers,
    currentUserId,
    currentUserRole,
    currentUserPermissions,
}: {
    initialUsers: User[];
    currentUserId: string;
    currentUserRole: Role;
    currentUserPermissions: string[];
}) {

    const [query, setQuery] = useState('');
    const [roleFilter,setRoleFilter] = useState('');
    const [activeFilter,setActiveFilter] = useState('');
    const [permissionFilter,setPermissionFilter] = useState('');
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const filteredUsers = users.filter(person => (!query || `${person.name || ''} ${person.email}`.toLowerCase().includes(query.toLowerCase())) && (!roleFilter || person.role === roleFilter) && (!activeFilter || person.isActive === (activeFilter === 'active')) && (!permissionFilter || person.role === 'ADMIN' || person.permissions.includes(permissionFilter)));
    const permissionOptions = [...new Set(users.flatMap(person => person.permissions))].sort();
    const filterClass = 'mt-1 block w-full rounded-md border-border bg-background text-sm text-foreground';
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
        // Staff are deactivated rather than deleted: their orders, leads and
        // audit trail stay attached to them, and the account can be revived.
        if (!confirm('Deactivate this staff account? They will be signed out and unable to sign in. You can reactivate them later.')) {
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

            toast.success('Staff account deactivated.');
            await handleUserChange();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred.');
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Staff</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage staff accounts and what each person can do.</p>
                </div>
                <AddUserButton onAddUser={openFormForCreate} />
            </div>

            <section aria-label="Staff filters" className="rounded-xl border border-border bg-card p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-muted-foreground">Name or email<input value={query} onChange={e=>setQuery(e.target.value)} className={filterClass} /></label><label className="text-xs text-muted-foreground">Role<select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} className={filterClass}><option value="">All roles</option>{[...new Set(users.map(person=>person.role))].map(role=><option key={role}>{role}</option>)}</select></label><label className="text-xs text-muted-foreground">Account status<select value={activeFilter} onChange={e=>setActiveFilter(e.target.value)} className={filterClass}><option value="">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label className="text-xs text-muted-foreground">Permission<select value={permissionFilter} onChange={e=>setPermissionFilter(e.target.value)} className={filterClass}><option value="">Any permission</option>{permissionOptions.map(permission=><option key={permission} value={permission}>{permission.replace(/_/g,' ').toLowerCase()}</option>)}</select></label></div><div className="mt-3 flex items-center justify-between"><p className="text-xs text-muted-foreground" aria-live="polite">{filteredUsers.length} of {users.length} staff</p><button onClick={()=>{setQuery('');setRoleFilter('');setActiveFilter('');setPermissionFilter('');}} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">Clear filters</button></div></section>
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                <UserList
                    users={filteredUsers}
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
                                actor={{
                                    id: currentUserId,
                                    role: currentUserRole,
                                    permissions: currentUserPermissions,
                                }}
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
