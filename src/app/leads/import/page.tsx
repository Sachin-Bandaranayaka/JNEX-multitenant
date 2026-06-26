// src/app/leads/import/page.tsx

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { parse } from 'papaparse';
import { z } from 'zod';
import { LeadSchema, type LeadData } from '@/lib/csv-parser';

// --- Type Definitions ---
type PreviewStatus = 'OK_TO_IMPORT' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INVALID_PRODUCT';

interface PreviewItem {
  data: LeadData;
  status: PreviewStatus;
  id: string; 
}

// --- NEW: Phone Number Normalization Helper ---
function normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    // Remove all non-digit characters, but keep a leading '+'
    let cleaned = phone.trim().replace(/[^\d+]/g, '');

    // Case 1: Starts with +94 and is a valid length (e.g., +94769259694)
    if (cleaned.startsWith('+94') && cleaned.length === 12) {
        return '0' + cleaned.substring(3);
    }
    // Case 2: Starts with 94 and is a valid length (e.g., 94769259694)
    if (cleaned.startsWith('94') && cleaned.length === 11) {
        return '0' + cleaned.substring(2);
    }
    // Case 3: Is a 9-digit number, assume it's a mobile number missing the leading 0
    if (cleaned.length === 9 && !cleaned.startsWith('0')) {
        return '0' + cleaned;
    }
    // Otherwise, return the number as is (or after basic cleaning)
    return cleaned.replace('+', ''); // Remove plus if it's not a +94 number
}


// --- UI Components ---

// 1. CSV Upload Component
function CSVUpload({
  onUploadComplete,
  setIsLoading,
}: {
  onUploadComplete: (leads: LeadData[]) => void;
  setIsLoading: (loading: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    parse<LeadData>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.toLowerCase().trim().replace(/\s+/g, '_'),
      complete: (results) => {
        try {
          const validatedLeads = z.array(LeadSchema).parse(results.data);
          
          // --- NEW: Normalize phone numbers after parsing ---
          const normalizedLeads = validatedLeads.map(lead => ({
              ...lead,
              phone: normalizePhoneNumber(lead.phone),
          }));

          onUploadComplete(normalizedLeads);

        } catch (err) {
          if (err instanceof z.ZodError) {
            setError(`CSV validation failed: ${err.errors.map(e => `(Row: ${e.path[0]}, Field: ${e.path[1]}, Message: ${e.message})`).join(', ')}`);
          } else {
            setError('An unexpected error occurred during parsing.');
          }
          setIsLoading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto genzo-card">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-[#ccd2da] border-dashed rounded-md cursor-pointer bg-[#f9fafb] hover:bg-[#f1f3f5] transition-colors"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-4 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
            </svg>
            <p className="mb-2 text-sm text-slate-600"><span className="font-semibold text-[#e89c31]">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-slate-400">CSV file (MAX. 5MB)</p>
          </div>
          <input id="dropzone-file" type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
        </label>
      </div>
      {error && <p className="mt-4 text-center text-red-500 font-semibold text-sm">{error}</p>}
    </div>
  );
}

// 2. Lead Preview Component
function LeadPreview({
  preview,
  onConfirm,
  onCancel,
  isImporting,
}: {
  preview: PreviewItem[];
  onConfirm: (leadsToImport: LeadData[]) => void;
  onCancel: () => void;
  isImporting: boolean;
}) {
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initialSelection = new Set<string>();
    preview.forEach(item => {
      if (item.status === 'OK_TO_IMPORT' || item.status === 'LOW_STOCK') {
        initialSelection.add(item.id);
      }
    });
    setSelectedLeads(initialSelection);
  }, [preview]);

  const handleSelectionChange = (itemId: string) => {
    setSelectedLeads(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      return newSelection;
    });
  };

  const statusConfig: Record<PreviewStatus, { label: string; class: string }> = {
    OK_TO_IMPORT: { label: 'OK to Import', class: 'genzo-tag genzo-tag-green' },
    LOW_STOCK: { label: 'Low Stock', class: 'genzo-tag genzo-tag-orange' },
    OUT_OF_STOCK: { label: 'Out of Stock', class: 'genzo-tag genzo-tag-red' },
    INVALID_PRODUCT: { label: 'Invalid Product', class: 'genzo-tag genzo-tag-gray' },
  };
  
  const summary = useMemo(() => {
    return preview.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {} as Record<PreviewStatus, number>);
  }, [preview]);

  const leadsToImport = preview.filter(item => selectedLeads.has(item.id)).map(item => item.data);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-700">Import Preview</h3>
        <p className="mt-1 text-sm text-slate-500">Review and confirm the leads to import. Leads for out-of-stock or invalid products will be skipped.</p>
      </div>
      
      <div className="flex flex-wrap gap-2.5">
        {Object.entries(summary).map(([status, count]) => (
            <div key={status} className={statusConfig[status as PreviewStatus].class}>
                {statusConfig[status as PreviewStatus].label}: {count}
            </div>
        ))}
      </div>

      <div className="max-h-[50vh] overflow-y-auto genzo-card p-0">
        <table className="genzo-table">
          <thead>
            <tr>
              <th className="w-12">Import</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((item) => (
              <tr key={item.id} className="hover:bg-[#fafbfc]">
                <td className="align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#d4d9e0] text-[#e89c31] focus:ring-[#e89c31] disabled:opacity-50 cursor-pointer"
                    checked={selectedLeads.has(item.id)}
                    disabled={item.status === 'OUT_OF_STOCK' || item.status === 'INVALID_PRODUCT'}
                    onChange={() => handleSelectionChange(item.id)}
                  />
                </td>
                <td>
                    <div className="font-semibold text-slate-700">{item.data.customer_name}</div>
                    <div className="text-xs text-slate-400">{item.data.phone}</div>
                </td>
                <td className="text-slate-600">{item.data.product_name} ({item.data.product_code})</td>
                <td>
                    <span className={statusConfig[item.status].class}>{statusConfig[item.status].label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} disabled={isImporting} className="genzo-btn genzo-btn-gray">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(leadsToImport)}
          disabled={isImporting || leadsToImport.length === 0}
          className="genzo-btn genzo-btn-amber disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? 'Importing...' : `Confirm Import (${leadsToImport.length})`}
        </button>
      </div>
    </div>
  );
}


// --- Main Page Component ---
export default function ImportLeadsPage() {
  const [stage, setStage] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUploadComplete = async (leads: LeadData[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', leads }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to get preview');
      
      const previewWithIds = result.preview.map((item: Omit<PreviewItem, 'id'>, index: number) => ({
        ...item,
        id: `${item.data.phone}-${item.data.product_code}-${index}`,
      }));

      setPreviewData(previewWithIds);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async (leadsToImport: LeadData[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', leads: leadsToImport }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to import leads');
      
      setImportResult(result);
      setStage('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStage('upload');
    setPreviewData([]);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="border-b border-[#e3e6ea] pb-5 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-700">Import Leads</h3>
            <p className="mt-2 max-w-4xl text-sm text-slate-500">
              {stage === 'upload' && 'Upload a CSV file to begin the import process.'}
              {stage === 'preview' && 'Review and select the leads to import.'}
              {stage === 'complete' && 'The import process has finished.'}
            </p>
          </div>
          <a href="/templates/lead-import-template.csv" download className="inline-flex items-center gap-2 rounded-md border border-[#ccd2da] bg-white text-slate-600 px-4 py-2 text-sm font-semibold hover:bg-[#f1f3f5] transition-colors">
            Download Template
          </a>
        </div>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {stage === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {isLoading ? <div className="text-center text-slate-500 font-semibold">Analyzing file...</div> : <CSVUpload onUploadComplete={handleUploadComplete} setIsLoading={setIsLoading} />}
              </motion.div>
            )}

            {stage === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LeadPreview preview={previewData} onConfirm={handleConfirmImport} onCancel={handleReset} isImporting={isLoading} />
              </motion.div>
            )}

            {stage === 'complete' && (
              <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="p-8 genzo-card max-w-md mx-auto">
                    <h4 className="text-xl font-bold text-[#3c8c3c]">Import Complete!</h4>
                    <p className="mt-2 text-slate-600">Successfully imported {importResult?.count || 0} leads.</p>
                    <button onClick={() => router.push('/leads')} className="mt-6 genzo-btn genzo-btn-amber">
                        Go to Leads Page
                    </button>
                    <button onClick={handleReset} className="mt-4 text-sm font-semibold text-[#5aa6e0] hover:underline block mx-auto">
                        Import another file
                    </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {error && stage !== 'preview' && <p className="mt-4 text-center text-red-500 font-semibold">{error}</p>}
        </div>
      </div>
    </div>
  );
}
