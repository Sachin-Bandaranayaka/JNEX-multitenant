// src/components/leads/lead-details-client.tsx

'use client';

import { useState } from 'react';
import { User } from 'next-auth';
import { Product } from '@prisma/client';
import { LeadDetails, type Lead as LeadDetailsType } from './lead-details';
import { LeadEditForm, type Lead } from './lead-edit-form';
import type { LeadWithRelations } from '@/app/(authenticated)/leads/[leadId]/page';
import { LeadData } from '@/types/leads';

interface LeadDetailsClientProps {
    initialLead: LeadWithRelations;
    products: Product[];
    user: User;
}

export function LeadDetailsClient({ initialLead, products, user }: LeadDetailsClientProps) {
    const [lead, setLead] = useState(initialLead);
    const [isEditing, setIsEditing] = useState(false);

    // --- PERMISSION CHECK ---
    const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_LEADS');

    const handleSuccess = () => {
        setIsEditing(false);
        // We can optionally refresh data here if needed
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {isEditing ? 'Edit Lead' : 'Lead Details'}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {isEditing ? 'Update the lead information below.' : `Viewing details for ${(lead.csvData as unknown as LeadData).name}`}
                    </p>
                </div>
                {/* --- PERMISSION-BASED UI --- */}
                {canEdit && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                    >
                        Edit Lead
                    </button>
                )}
            </div>

            <div className={isEditing ? "rounded-xl border border-border bg-card shadow-sm p-6 sm:p-8" : ""}>
                {isEditing ? (
                    <LeadEditForm
                        lead={lead as unknown as Lead}
                        products={products}
                        onSuccess={handleSuccess}
                        onCancel={() => setIsEditing(false)}
                    />
                ) : (
                    <LeadDetails lead={lead as unknown as LeadDetailsType} />
                )}
            </div>
        </div>
    );
}