'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
// --- NEW: Import the password update action ---
import { updateTenantSettings, updateUserPassword } from './actions';
import { Tenant, ShippingProvider } from '@prisma/client';

// Submit button for the main settings form
function SettingsSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
      {pending ? 'Saving...' : 'Save Settings'}
    </button>
  );
}

// --- NEW: Submit button for the password form ---
function PasswordSubmitButton() {
    const { pending } = useFormStatus();
    return (
      <button 
        type="submit" 
        disabled={pending}
        className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Updating...' : 'Update Password'}
      </button>
    );
}

export function SettingsForm({ tenant }: { tenant: Tenant }) {
  // State for the main settings form
  const [settingsState, settingsDispatch] = useActionState(updateTenantSettings, undefined);
  // --- NEW: State for the password form ---
  const [passwordState, passwordDispatch] = useActionState(updateUserPassword, undefined);

  return (
    // This component now returns a single div wrapping both forms
    <div className="space-y-12">
        {/* --- FORM 1: Business Profile & API Keys --- */}
        <form action={settingsDispatch} className="space-y-8 divide-y divide-gray-700">
            {/* Business Profile Section */}
            <div>
                <h3 className="text-lg font-medium text-white">Business Profile</h3>
                <p className="mt-1 text-sm text-gray-400">Update your company's branding and invoice details.</p>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-4">
                        <label htmlFor="businessName" className="block text-sm font-medium text-gray-300">Business Name</label>
                        <input type="text" name="businessName" id="businessName" defaultValue={tenant.businessName || ''} className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm"/>
                    </div>
                    <div className="sm:col-span-6">
                        <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-300">Business Address</label>
                        <textarea name="businessAddress" id="businessAddress" rows={3} defaultValue={tenant.businessAddress || ''} className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm"></textarea>
                    </div>
                    <div className="sm:col-span-3">
                        <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-300">Business Phone</label>
                        <input type="text" name="businessPhone" id="businessPhone" defaultValue={tenant.businessPhone || ''} className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm"/>
                    </div>
                    <div className="sm:col-span-3">
                        <label htmlFor="invoicePrefix" className="block text-sm font-medium text-gray-300">Invoice Prefix</label>
                        <input type="text" name="invoicePrefix" id="invoicePrefix" defaultValue={tenant.invoicePrefix || ''} placeholder="e.g., INV-" className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm"/>
                    </div>
                </div>
            </div>

            {/* Shipping Settings Section */}
            <div className="pt-8">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-white">Shipping Settings</h3>
                    <p className="mt-1 text-sm text-gray-400">Configure your default shipping options.</p>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                        <label htmlFor="defaultShippingProvider" className="block text-sm font-medium text-gray-300">Default Shipping Provider</label>
                        <select
                            id="defaultShippingProvider"
                            name="defaultShippingProvider"
                            defaultValue={tenant.defaultShippingProvider || ''}
                            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                            {Object.values(ShippingProvider).map((provider) => (
                                <option key={provider} value={provider}>
                                    {provider.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            
            {/* API Keys Section */}
            <div className="pt-8">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-white">Shipping API Keys</h3>
                    <p className="mt-1 text-sm text-gray-400">Enter your own API keys for shipping providers.</p>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                        <label htmlFor="fardaExpressClientId" className="block text-sm font-medium text-gray-300">Farda Express Client ID</label>
                        <p className="mt-1 text-xs text-gray-400">Your Farda Express client identifier</p>
                        <input type="text" name="fardaExpressClientId" id="fardaExpressClientId" defaultValue={tenant.fardaExpressClientId || ''} className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm" />
                    </div>
                    <div className="sm:col-span-3">
                        <label htmlFor="fardaExpressApiKey" className="block text-sm font-medium text-gray-300">Farda Express API Key</label>
                        <p className="mt-1 text-xs text-gray-400">Your Farda Express API key</p>
                        <input type="password" name="fardaExpressApiKey" id="fardaExpressApiKey" defaultValue={tenant.fardaExpressApiKey || ''} className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm" />
                    </div>
                    <div className="sm:col-span-6">
                        <label htmlFor="transExpressApiKey" className="block text-sm font-medium text-gray-300">Trans Express API Key</label>
                        <p className="mt-1 text-xs text-gray-400">Enter your single API key for Trans Express</p>
                        <input type="password" name="transExpressApiKey" id="transExpressApiKey" defaultValue={tenant.transExpressApiKey || ''} className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm" />
                    </div>
                    <div className="sm:col-span-6">
                        <label htmlFor="royalExpressApiKey" className="block text-sm font-medium text-gray-300">Royal Express Credentials</label>
                        <p className="mt-1 text-xs text-gray-400">Enter in format: email:password (e.g., user@example.com:yourpassword)</p>
                        <input type="password" name="royalExpressApiKey" id="royalExpressApiKey" defaultValue={tenant.royalExpressApiKey || ''} placeholder="email:password" className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm" />
                    </div>
                </div>
            </div>

            <div className="pt-5">
                <div className="flex justify-end gap-x-3">
                    {settingsState?.status === 'error' && <p className="text-sm text-red-400 self-center">{settingsState.message}</p>}
                    {settingsState?.status === 'success' && <p className="text-sm text-green-400 self-center">{settingsState.message}</p>}
                    <SettingsSubmitButton />
                </div>
            </div>
        </form>

        {/* --- FORM 2: Change Password --- */}
        <div className="pt-8">
            <div>
                <h3 className="text-lg font-medium leading-6 text-white">Security</h3>
                <p className="mt-1 text-sm text-gray-400">Change your account password.</p>
            </div>
            <form action={passwordDispatch} className="mt-6 max-w-xl">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-300">New Password</label>
                        <div className="mt-2">
                            <input type="password" name="password" id="password" className="block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm" required minLength={8} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium leading-6 text-gray-300">Confirm New Password</label>
                        <div className="mt-2">
                            <input type="password" name="confirmPassword" id="confirmPassword" className="block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm" required />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-x-3">
                    {passwordState?.status === 'error' && <p className="text-sm text-red-400 self-center">{passwordState.message}</p>}
                    {passwordState?.status === 'success' && <p className="text-sm text-green-400 self-center">{passwordState.message}</p>}
                    <PasswordSubmitButton />
                </div>
            </form>
        </div>
    </div>
  );
}