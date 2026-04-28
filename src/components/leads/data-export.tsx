'use client';

import { useState } from 'react';
import {
  ClipboardDocumentIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

interface DataExportProps {
  data: Record<string, any>[];
  columns: { key: string; label: string }[];
  filename?: string;
}

export function DataExport({ data, columns, filename = 'export' }: DataExportProps) {
  const [copying, setCopying] = useState(false);

  const getExportData = () => {
    return data.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        obj[col.label] = row[col.key] ?? '';
      });
      return obj;
    });
  };

  const handleCopy = async () => {
    setCopying(true);
    const header = columns.map((c) => c.label).join('\t');
    const rows = data.map((row) => columns.map((c) => row[c.key] ?? '').join('\t'));
    const text = [header, ...rows].join('\n');
    await navigator.clipboard.writeText(text);
    setCopying(false);
  };

  const handleCSV = () => {
    const header = columns.map((c) => `"${c.label}"`).join(',');
    const rows = data.map((row) =>
      columns.map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = getExportData();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handlePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape' });
    const head = [columns.map((c) => c.label)];
    const body = data.map((row) => columns.map((c) => String(row[c.key] ?? '')));
    autoTable(doc, { head, body, styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] } });
    doc.save(`${filename}.pdf`);
  };

  const handlePrint = () => {
    const header = columns.map((c) => `<th style="padding:6px 10px;border:1px solid #ddd;background:#f5f5f5;font-size:12px;text-align:left">${c.label}</th>`).join('');
    const rows = data
      .map(
        (row) =>
          '<tr>' +
          columns
            .map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${row[c.key] ?? ''}</td>`)
            .join('') +
          '</tr>'
      )
      .join('');
    const html = `<html><head><title>Print</title></head><body><table style="border-collapse:collapse;width:100%"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  const btnClass =
    'px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-white dark:bg-card text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button onClick={handleCopy} className={btnClass} title="Copy to clipboard">
        <ClipboardDocumentIcon className="h-3.5 w-3.5" />
        {copying ? 'Copied!' : 'Copy'}
      </button>
      <button onClick={handleCSV} className={btnClass} title="Download CSV">
        <DocumentTextIcon className="h-3.5 w-3.5" />
        CSV
      </button>
      <button onClick={handleExcel} className={btnClass} title="Download Excel">
        <TableCellsIcon className="h-3.5 w-3.5" />
        Excel
      </button>
      <button onClick={handlePDF} className={btnClass} title="Download PDF">
        <DocumentArrowDownIcon className="h-3.5 w-3.5" />
        PDF
      </button>
      <button onClick={handlePrint} className={btnClass} title="Print">
        <PrinterIcon className="h-3.5 w-3.5" />
        Print
      </button>
    </div>
  );
}
