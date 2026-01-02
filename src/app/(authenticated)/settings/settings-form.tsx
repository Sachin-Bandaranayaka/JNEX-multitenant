'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateTenantSettings, updateUserPassword } from './actions';
import { Tenant, ShippingProvider } from '@prisma/client';
import { motion } from 'framer-motion';
import {
    BuildingOfficeIcon,
    TruckIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';

function SettingsSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
        >
            {pending ? (
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                </div>
            ) : (
                'Save Settings'
            )}
        </button>
    );
}

function PasswordSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-destructive px-6 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50"
        >
            {pending ? (
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Updating...</span>
                </div>
            ) : (
                'Update Password'
            )}
        </button>
    );
}

export function SettingsForm({ tenant }: { tenant: Tenant }) {
    const [settingsState, settingsDispatch] = useActionState(updateTenantSettings, undefined);
    const [passwordState, passwordDispatch] = useActionState(updateUserPassword, undefined);

    return (
        <div className="space-y-8">
            {/* --- FORM 1: Business Profile & API Keys --- */}
            <form action={settingsDispatch} className="space-y-8">
                {/* Business Profile Section */}
                <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <BuildingOfficeIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Business Profile</h3>
                            <p className="text-sm text-muted-foreground">Update your company's branding and invoice details.</p>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label htmlFor="businessName" className="block text-sm font-medium text-muted-foreground mb-2">Business Name</label>
                            <input type="text" name="businessName" id="businessName" defaultValue={tenant.businessName || ''} className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="businessAddress" className="block text-sm font-medium text-muted-foreground mb-2">Business Address</label>
                            <textarea name="businessAddress" id="businessAddress" rows={3} defaultValue={tenant.businessAddress || ''} className="w-full p-4 rounded-3xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"></textarea>
                        </div>
                        <div>
                            <label htmlFor="businessPhone" className="block text-sm font-medium text-muted-foreground mb-2">Business Phone</label>
                            <input type="text" name="businessPhone" id="businessPhone" defaultValue={tenant.businessPhone || ''} className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                        <div>
                            <label htmlFor="invoicePrefix" className="block text-sm font-medium text-muted-foreground mb-2">Invoice Prefix</label>
                            <input type="text" name="invoicePrefix" id="invoicePrefix" defaultValue={tenant.invoicePrefix || ''} placeholder="e.g., INV-" className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                    </div>
                </div>

                {/* Shipping Settings Section */}
                <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <TruckIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Shipping Settings</h3>
                            <p className="text-sm text-muted-foreground">Configure your default shipping options.</p>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                            <label htmlFor="defaultShippingProvider" className="block text-sm font-medium text-muted-foreground mb-2">Default Shipping Provider</label>
                            <div className="relative">
                                <select
                                    id="defaultShippingProvider"
                                    name="defaultShippingProvider"
                                    defaultValue={tenant.defaultShippingProvider || ''}
                                    className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
                                >
                                    {Object.values(ShippingProvider).map((provider) => (
                                        <option key={provider} value={provider}>
                                            {provider.replace('_', ' ')}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                <div className="flex justify-end gap-x-3 items-center pt-4">
                    {settingsState?.status === 'error' && (
                        <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-destructive font-medium">{settingsState.message}</motion.p>
                    )}
                    {settingsState?.status === 'success' && (
                        <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-green-600 dark:text-green-400 font-medium">{settingsState.message}</motion.p>
                    )}
                    <SettingsSubmitButton />
                </div>
            </form>

            {/* --- FORM 2: Change Password --- */}
            <div className="bg-card rounded-3xl border border-destructive/20 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-destructive/5 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                        <ShieldCheckIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Security</h3>
                        <p className="text-sm text-muted-foreground">Change your account password.</p>
                    </div>
                </div>

                <div className="p-6">
                    <form action={passwordDispatch} className="max-w-xl space-y-6">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">New Password</label>
                            <input type="password" name="password" id="password" className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive transition-all" required minLength={8} />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground mb-2">Confirm New Password</label>
                            <input type="password" name="confirmPassword" id="confirmPassword" className="w-full h-12 px-4 rounded-full border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive transition-all" required />
                        </div>

                        <div className="flex items-center justify-end gap-x-3 pt-2">
                            {passwordState?.status === 'error' && (
                                <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-destructive font-medium">{passwordState.message}</motion.p>
                            )}
                            {passwordState?.status === 'success' && (
                                <motion.p initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-green-600 dark:text-green-400 font-medium">{passwordState.message}</motion.p>
                            )}
                            <PasswordSubmitButton />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}