// src/app/leads/import/page.tsx

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { parse } from 'papaparse';
import { toast } from 'sonner';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// --- Type Definitions ---
type StockStatus = 'OK_TO_IMPORT' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INVALID_PRODUCT' | 'PENDING';

interface PreviewRow {
  id: string;
  customer_name: string;
  phone: string;
  second_phone: string;
  address: string;
  product_code: string;
  product_name: string;
  email: string;
  notes: string;
  
  errors: Record<string, string>;
  stockStatus: StockStatus;
  selected: boolean;
}

// --- Phone Number Normalization Helper ---
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+94') && cleaned.length === 12) {
    return '0' + cleaned.substring(3);
  }
  if (cleaned.startsWith('94') && cleaned.length === 11) {
    return '0' + cleaned.substring(2);
  }
  if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  return cleaned.replace('+', '');
}

// --- Row-level Field Validation ---
const validateRow = (row: {
  customer_name: string;
  phone: string;
  address: string;
  product_code: string;
  email: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!row.customer_name.trim()) {
    errors.customer_name = 'Name is required';
  }
  if (!row.phone.trim()) {
    errors.phone = 'Phone is required';
  }
  if (!row.address.trim()) {
    errors.address = 'Address is required';
  }
  if (!row.product_code.trim()) {
    errors.product_code = 'Product code is required';
  }
  if (row.email.trim() && !/\S+@\S+\.\S+/.test(row.email)) {
    errors.email = 'Invalid email';
  }
  return errors;
};

// Helper to clean and format rows for sending to the import API
const cleanLeadsForPayload = (rows: PreviewRow[]) => {
  return rows.map((r) => {
    const lead: any = {
      customer_name: r.customer_name.trim(),
      phone: r.phone.trim(),
      address: r.address.trim(),
      product_code: r.product_code.trim().toUpperCase(),
    };
    if (r.second_phone && r.second_phone.trim()) {
      lead.second_phone = r.second_phone.trim();
    }
    if (r.product_name && r.product_name.trim()) {
      lead.product_name = r.product_name.trim();
    }
    if (r.email && r.email.trim()) {
      lead.email = r.email.trim();
    }
    if (r.notes && r.notes.trim()) {
      lead.notes = r.notes.trim();
    }
    return lead;
  });
};

// 1. CSV Upload Component
function CSVUpload({
  onUploadComplete,
  setIsLoading,
  isLoading,
}: {
  onUploadComplete: (rows: PreviewRow[]) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.toLowerCase().trim().replace(/\s+/g, '_'),
      complete: (results) => {
        try {
          if (!results.data || results.data.length === 0) {
            throw new Error('CSV file is empty');
          }

          const initialRows: PreviewRow[] = results.data.map((row, index) => {
            const customer_name = row.customer_name || row.name || '';
            const phone = normalizePhoneNumber(row.phone || row.phone_number || row.contact || '');
            const second_phone = normalizePhoneNumber(row.second_phone || row.second_phone_number || row.contact_2 || '');
            const address = row.address || row.customer_address || '';
            const product_code = (row.product_code || row.code || '').trim().toUpperCase();
            const product_name = row.product_name || row.item || '';
            const email = row.email || '';
            const notes = row.notes || row.remark || '';

            const rowData = { customer_name, phone, second_phone, address, product_code, product_name, email, notes };
            const errors = validateRow(rowData);

            return {
              id: `row-${index}-${Date.now()}`,
              ...rowData,
              errors,
              stockStatus: 'PENDING',
              selected: Object.keys(errors).length === 0, // Checked by default if valid
            };
          });

          onUploadComplete(initialRows);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred during parsing.');
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
          <input id="dropzone-file" type="file" className="hidden" accept=".csv" onChange={handleFileChange} disabled={isLoading} />
        </label>
      </div>
      {error && <p className="mt-4 text-center text-red-500 font-semibold text-sm">{error}</p>}
    </div>
  );
}

// 2. Lead Preview Component (Excel-like Grid Table)
function LeadPreview({
  previewRows,
  setPreviewRows,
  onConfirm,
  onCancel,
  isImporting,
}: {
  previewRows: PreviewRow[];
  setPreviewRows: React.Dispatch<React.SetStateAction<PreviewRow[]>>;
  onConfirm: (leadsToImport: any[]) => void;
  onCancel: () => void;
  isImporting: boolean;
}) {
  const [activeCell, setActiveCell] = useState<{ id: string; field: keyof PreviewRow } | null>(null);

  // Auto-checks stock statuses for pending rows
  useEffect(() => {
    const pendingRows = previewRows.filter(
      (row) => row.stockStatus === 'PENDING' && !row.errors.product_code
    );
    if (pendingRows.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const payloadLeads = cleanLeadsForPayload(pendingRows);
        const response = await fetch('/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'preview', leads: payloadLeads }),
        });
        const result = await response.json();
        
        if (response.ok && result.preview) {
          setPreviewRows((prev) =>
            prev.map((row) => {
              const idx = pendingRows.findIndex((pr) => pr.id === row.id);
              if (idx !== -1 && result.preview[idx]) {
                const stockStatus = result.preview[idx].status as StockStatus;
                // If it was auto-selected and now stock status is bad, auto-deselect it
                const selected = row.selected && (stockStatus === 'OK_TO_IMPORT' || stockStatus === 'LOW_STOCK');
                return {
                  ...row,
                  stockStatus,
                  selected,
                };
              }
              return row;
            })
          );
        }
      } catch (err) {
        console.error('Error fetching stock status:', err);
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(timer);
  }, [previewRows, setPreviewRows]);

  const handleCellChange = (id: string, field: keyof PreviewRow, value: string) => {
    setPreviewRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const updatedRow = { ...row, [field]: value };
        
        // Re-validate fields
        const fieldErrors = validateRow({
          customer_name: updatedRow.customer_name,
          phone: updatedRow.phone,
          address: updatedRow.address,
          product_code: updatedRow.product_code,
          email: updatedRow.email,
        });
        
        updatedRow.errors = fieldErrors;

        // If product_code changed, reset stockStatus to PENDING so it re-checks
        if (field === 'product_code' && value.trim().toUpperCase() !== row.product_code) {
          updatedRow.stockStatus = 'PENDING';
          updatedRow.product_code = value.trim().toUpperCase();
        }

        // If row becomes invalid, deselect it. If it becomes valid and importable, select it
        const hasErrors = Object.keys(fieldErrors).length > 0;
        if (hasErrors) {
          updatedRow.selected = false;
        } else if (!row.selected && (updatedRow.stockStatus === 'OK_TO_IMPORT' || updatedRow.stockStatus === 'LOW_STOCK')) {
          updatedRow.selected = true;
        }

        return updatedRow;
      })
    );
  };

  const handleSelectRow = (id: string) => {
    setPreviewRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, selected: !row.selected };
      })
    );
  };

  // Determine selectable and importable rows
  const selectableRows = useMemo(() => {
    return previewRows.filter(
      (row) =>
        Object.keys(row.errors).length === 0 &&
        (row.stockStatus === 'OK_TO_IMPORT' || row.stockStatus === 'LOW_STOCK')
    );
  }, [previewRows]);

  const allSelected = useMemo(() => {
    return selectableRows.length > 0 && selectableRows.every((r) => r.selected);
  }, [selectableRows]);

  const handleSelectAll = () => {
    const nextState = !allSelected;
    setPreviewRows((prev) =>
      prev.map((row) => {
        const isSelectable =
          Object.keys(row.errors).length === 0 &&
          (row.stockStatus === 'OK_TO_IMPORT' || row.stockStatus === 'LOW_STOCK');
        return {
          ...row,
          selected: isSelectable ? nextState : false,
        };
      })
    );
  };

  const selectedRows = previewRows.filter((r) => r.selected);

  const statusConfig: Record<StockStatus, { label: string; class: string }> = {
    OK_TO_IMPORT: { label: 'OK to Import', class: 'genzo-tag genzo-tag-green' },
    LOW_STOCK: { label: 'Low Stock', class: 'genzo-tag genzo-tag-orange' },
    OUT_OF_STOCK: { label: 'Out of Stock', class: 'genzo-tag genzo-tag-red' },
    INVALID_PRODUCT: { label: 'Invalid Product', class: 'genzo-tag genzo-tag-gray' },
    PENDING: { label: 'Checking...', class: 'genzo-tag bg-blue-50 text-blue-600 animate-pulse' },
  };

  const summary = useMemo(() => {
    return previewRows.reduce((acc, item) => {
      acc[item.stockStatus] = (acc[item.stockStatus] || 0) + 1;
      return acc;
    }, {} as Record<StockStatus, number>);
  }, [previewRows]);

  const totalErrors = useMemo(() => {
    return previewRows.filter((r) => Object.keys(r.errors).length > 0).length;
  }, [previewRows]);

  const handleConfirmImportClick = () => {
    const leadsToImport = cleanLeadsForPayload(selectedRows);
    onConfirm(leadsToImport);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-md border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-700">Leads Import Preview Grid</h3>
          <p className="mt-1 text-xs text-slate-500">
            Double-click or click any cell to edit values directly. Grid cells highlighted in red are invalid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(summary).map(([status, count]) => (
            <div key={status} className={statusConfig[status as StockStatus].class}>
              {statusConfig[status as StockStatus].label}: {count}
            </div>
          ))}
          {totalErrors > 0 && (
            <div className="genzo-tag bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 font-bold">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
              Rows with errors: {totalErrors}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#fcfdfe] p-3 rounded-md border border-blue-100 flex items-start gap-2.5 text-xs text-blue-700 bg-blue-50/50">
        <InformationCircleIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Workflow Guidance:</span> Double-click on any cell to modify. Fill in the missing required fields (marked *). Correct invalid product codes to let the system verify stock status. Checked rows will be imported to the lead list.
        </div>
      </div>

      {/* Excel-like scrollable table container */}
      <div className="max-h-[55vh] overflow-auto rounded-md border border-slate-200 shadow-sm bg-white">
        <table className="w-full border-collapse text-xs select-none no-genzo-override">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b-2 border-slate-300">
              <th className="w-12 text-center p-2 border-r border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#e89c31] focus:ring-[#e89c31] cursor-pointer"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  disabled={selectableRows.length === 0}
                />
              </th>
              <th className="w-12 text-center p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-500">Row</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Customer Name *</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Phone *</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Second Phone</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Address *</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Product Code *</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Email</th>
              <th className="text-left p-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-600">Notes</th>
              <th className="text-left p-2 border-slate-200 bg-slate-50 font-bold text-slate-600">Alerts & Status</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, idx) => {
              const isRowSelectable =
                Object.keys(row.errors).length === 0 &&
                (row.stockStatus === 'OK_TO_IMPORT' || row.stockStatus === 'LOW_STOCK');

              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50 border-b border-slate-200 transition-colors ${
                    row.selected ? 'bg-emerald-50/20' : Object.keys(row.errors).length > 0 ? 'bg-red-50/10' : ''
                  }`}
                >
                  <td className="p-2 border-r border-slate-200 align-middle text-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#e89c31] focus:ring-[#e89c31] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      checked={row.selected}
                      disabled={!isRowSelectable}
                      onChange={() => handleSelectRow(row.id)}
                    />
                  </td>
                  <td className="p-2 border-r border-slate-200 align-middle text-center text-slate-400 font-mono font-medium">
                    {idx + 1}
                  </td>
                  
                  {/* Customer Name Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.customer_name}
                      onChange={(e) => handleCellChange(row.id, 'customer_name', e.target.value)}
                      className={`w-full bg-transparent border px-2 py-1 rounded text-xs focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all ${
                        row.errors.customer_name
                          ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      placeholder="Name required"
                    />
                  </td>

                  {/* Phone Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.phone}
                      onChange={(e) => handleCellChange(row.id, 'phone', e.target.value)}
                      className={`w-full bg-transparent border px-2 py-1 rounded text-xs font-mono focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all ${
                        row.errors.phone
                          ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      placeholder="Phone required"
                    />
                  </td>

                  {/* Second Phone Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.second_phone}
                      onChange={(e) => handleCellChange(row.id, 'second_phone', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-slate-300 px-2 py-1 rounded text-xs font-mono focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all"
                      placeholder="Optional number"
                    />
                  </td>

                  {/* Address Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.address}
                      onChange={(e) => handleCellChange(row.id, 'address', e.target.value)}
                      className={`w-full bg-transparent border px-2 py-1 rounded text-xs focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all ${
                        row.errors.address
                          ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      placeholder="Address required"
                    />
                  </td>

                  {/* Product Code Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.product_code}
                      onChange={(e) => handleCellChange(row.id, 'product_code', e.target.value)}
                      className={`w-full bg-transparent border px-2 py-1 rounded text-xs font-mono font-semibold focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all ${
                        row.errors.product_code
                          ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      placeholder="Code required"
                    />
                  </td>

                  {/* Email Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.email}
                      onChange={(e) => handleCellChange(row.id, 'email', e.target.value)}
                      className={`w-full bg-transparent border px-2 py-1 rounded text-xs focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all ${
                        row.errors.email
                          ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      placeholder="Optional email"
                    />
                  </td>

                  {/* Notes Cell */}
                  <td className="p-0.5 border-r border-slate-200 align-middle">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => handleCellChange(row.id, 'notes', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-slate-300 px-2 py-1 rounded text-xs focus:bg-white focus:ring-1 focus:ring-[#e89c31] focus:outline-none transition-all"
                      placeholder="Optional notes"
                    />
                  </td>

                  {/* Alerts & Status Cell */}
                  <td className="p-2 align-middle max-w-xs">
                    {Object.keys(row.errors).length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {Object.entries(row.errors).map(([field, msg]) => (
                          <span key={field} className="text-[10px] font-semibold text-red-600 flex items-center gap-0.5">
                            <ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0 text-red-500" />
                            {msg}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={statusConfig[row.stockStatus].class}>
                        {statusConfig[row.stockStatus].label}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-200">
        <span className="text-xs font-semibold text-slate-500">
          Selected: {selectedRows.length} / {previewRows.length} leads
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={isImporting} className="genzo-btn genzo-btn-gray">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImportClick}
            disabled={isImporting || selectedRows.length === 0}
            className="genzo-btn genzo-btn-amber disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
          >
            {isImporting ? (
              <span className="flex items-center gap-1">
                <ArrowPathIcon className="w-4 h-4 animate-spin" /> Importing...
              </span>
            ) : (
              `Confirm Import (${selectedRows.length})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function ImportLeadsPage() {
  const [stage, setStage] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUploadComplete = (initialRows: PreviewRow[]) => {
    setPreviewRows(initialRows);
    setStage('preview');
    setIsLoading(false);
  };

  const handleConfirmImport = async (leadsToImport: any[]) => {
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
      toast.success(`Successfully imported ${result.count} leads`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast.error(err instanceof Error ? err.message : 'Failed to import leads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStage('upload');
    setPreviewRows([]);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 bg-background">
      <div className="px-4 py-6 sm:px-0">
        <div className="border-b border-[#e3e6ea] pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-700 flex items-center gap-2">
              <ArrowUpTrayIcon className="w-6 h-6 text-[#e89c31]" />
              Import Leads
            </h3>
            <p className="mt-1 max-w-4xl text-xs text-slate-500">
              {stage === 'upload' && 'Upload a CSV file containing leads to preview and import them into the system.'}
              {stage === 'preview' && 'Review parsed values in the spreadsheet, resolve highlight issues, and confirm rows.'}
              {stage === 'complete' && 'Lead import workflow successfully completed.'}
            </p>
          </div>
          <a
            href="/templates/lead-import-template.csv"
            download
            className="inline-flex items-center gap-2 rounded-md border border-[#ccd2da] bg-white text-slate-600 px-4 py-2 text-xs font-semibold hover:bg-[#f1f3f5] transition-colors shadow-sm"
          >
            Download CSV Template
          </a>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {stage === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-12">
                    <ArrowPathIcon className="h-10 w-10 text-[#e89c31] animate-spin mb-3" />
                    <div className="text-slate-500 font-semibold text-sm">Processing and validating CSV file...</div>
                  </div>
                ) : (
                  <CSVUpload onUploadComplete={handleUploadComplete} setIsLoading={setIsLoading} isLoading={isLoading} />
                )}
              </motion.div>
            )}

            {stage === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LeadPreview
                  previewRows={previewRows}
                  setPreviewRows={setPreviewRows}
                  onConfirm={handleConfirmImport}
                  onCancel={handleReset}
                  isImporting={isLoading}
                />
              </motion.div>
            )}

            {stage === 'complete' && (
              <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <div className="p-8 genzo-card max-w-md mx-auto shadow-md">
                  <CheckCircleIcon className="w-16 h-16 text-[#5cb85c] mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-slate-700">Import Complete!</h4>
                  <p className="mt-2 text-sm text-slate-600">
                    Successfully imported <span className="font-bold text-[#e89c31]">{importResult?.count || 0}</span> leads into your database.
                  </p>
                  <div className="mt-8 flex flex-col gap-3.5">
                    <button onClick={() => router.push('/leads')} className="w-full genzo-btn genzo-btn-amber shadow-sm">
                      Go to Lead List
                    </button>
                    <button onClick={handleReset} className="w-full genzo-btn genzo-btn-gray border border-slate-200">
                      Import Another File
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {error && stage !== 'preview' && <p className="mt-4 text-center text-red-500 font-semibold text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
}
