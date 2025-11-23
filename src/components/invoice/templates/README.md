# Invoice Template Components

This directory contains React components for rendering invoices in three different formats optimized for A4 paper.

## Components

### FullPageInvoice

Renders a single invoice occupying one complete A4 page (210mm × 297mm) with generous spacing.

**Features:**
- Large, readable fonts (title: 16pt, normal: 10pt, small: 8pt)
- Detailed itemized product information
- Shipping information section
- Notes section
- Thank you message
- Large barcode (80mm × 50mm)

**Use case:** Important orders, detailed invoices, customer-facing documents

### HalfPageInvoice

Renders an invoice in a compact layout that fits two invoices per A4 page (210mm × 148.5mm).

**Features:**
- Medium fonts (title: 12pt, normal: 8pt, small: 7pt)
- Compact layout with all essential information
- Combined phone numbers for space efficiency
- Medium barcode (60mm × 35mm)
- Optional cut lines between invoices

**Use case:** Standard orders, moderate paper savings, balanced readability

### QuarterPageInvoice

Renders an invoice in minimal layout that fits four invoices per A4 page (105mm × 148.5mm) in a 2×2 grid.

**Features:**
- Small fonts (title: 10pt, normal: 7pt, small: 6pt)
- Minimal spacing with essential information only
- Compact barcode (45mm × 25mm)
- Optional cut lines around invoice
- Omits optional fields (shipping, notes) for space

**Use case:** High-volume printing, maximum paper efficiency, internal use

## Usage

```tsx
import { FullPageInvoice, HalfPageInvoice, QuarterPageInvoice } from '@/components/invoice/templates';
import { InvoiceData, InvoiceFormat } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';

// Prepare invoice data
const invoiceData: InvoiceData = {
  invoiceNumber: 'INV-12345',
  businessName: 'Your Company',
  businessAddress: '123 Business St',
  businessPhone: '555-1234',
  customerName: 'John Doe',
  customerAddress: '456 Customer Ave',
  customerPhone: '555-5678',
  amount: 1000,
  productName: 'Product Name',
  quantity: 2,
  discount: 50,
  createdAt: new Date(),
};

// Get format configuration
const config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE];

// Render invoice
<FullPageInvoice 
  data={invoiceData} 
  config={config} 
  showCutLines={false} 
/>
```

## Props

All three components accept the same props:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `InvoiceData` | Yes | Invoice data including customer info, amounts, products |
| `config` | `InvoiceFormatConfig` | Yes | Format configuration (dimensions, fonts, margins) |
| `showCutLines` | `boolean` | No | Whether to show dashed cut lines (default: false) |

## InvoiceData Interface

```typescript
interface InvoiceData {
  invoiceNumber: string;
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerSecondPhone?: string | null;
  amount: number;
  productName: string;
  quantity: number;
  discount: number;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  notes?: string | null;
  createdAt: Date;
}
```

## Missing Data Handling

All templates gracefully handle missing tenant data by displaying placeholder text:

- `businessName: null` → "Your Company"
- `businessAddress: null` → "Your Address"
- `businessPhone: null` → "Your Phone"

Optional fields (tracking, notes, second phone) are simply omitted if not provided.

## Cut Lines

When `showCutLines={true}`:

- **HalfPageInvoice**: Shows a horizontal dashed line at the bottom
- **QuarterPageInvoice**: Shows dashed border around the entire invoice

Cut lines help with manual cutting when printing multiple invoices per page.

## Styling

All templates use:
- Inline styles for precise sizing (mm units)
- Tailwind CSS classes for layout and spacing
- Print-safe fonts (Helvetica, Arial, Times)
- High-contrast colors (black text on white background)
- Responsive sizing based on format configuration

## Example

See `example.tsx` for a complete interactive example with format switching and cut line toggle.

## Requirements Validation

These components satisfy the following requirements:

- **Requirement 3.1**: Full-page format occupies one complete A4 page ✓
- **Requirement 4.1**: Half-page format fits exactly two invoices on one A4 page ✓
- **Requirement 5.1**: Quarter-page format fits exactly four invoices on one A4 page ✓
- **Requirement 2.1-2.5**: All formats include essential information (barcode, addresses, totals, phone numbers) ✓
- **Requirement 6.4**: Missing tenant data displays placeholder text ✓
- **Requirement 9.2**: Uses print-safe fonts ✓
- **Requirement 9.3**: Uses high-contrast colors for readability ✓

## Testing

Unit tests are available in `__tests__/invoice-templates.test.tsx`.

Run tests:
```bash
npm test -- src/components/invoice/__tests__/invoice-templates.test.tsx
```
