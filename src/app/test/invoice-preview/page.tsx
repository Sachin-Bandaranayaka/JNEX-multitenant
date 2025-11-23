import { InvoicePreviewExample } from '@/components/invoice/invoice-preview-example';

/**
 * Test page for invoice preview functionality
 * Navigate to /test/invoice-preview to see the preview in action
 */
export default function InvoicePreviewTestPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <InvoicePreviewExample />
    </div>
  );
}
