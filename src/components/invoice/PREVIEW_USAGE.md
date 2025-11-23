# Invoice Preview Component

## Overview

The `InvoicePreview` component provides a visual preview of invoice formats, allowing users to see how their invoices will look before generating PDFs. The preview updates automatically when the format changes and can display cut lines for multi-invoice layouts.

## Components

### InvoicePreview

Main preview component that renders the selected invoice format with sample data.

**Props:**
- `format: InvoiceFormat` - The invoice format to preview (FULL_PAGE, HALF_PAGE, or QUARTER_PAGE)
- `showCutLines?: boolean` - Whether to show cut lines in the preview (default: true)
- `sampleData?: InvoiceData` - Custom sample data to display (optional, uses default sample data if not provided)

**Features:**
- Automatically renders the correct number of invoices per format (1, 2, or 4)
- Shows cut lines for multi-invoice formats
- Scales preview to fit screen while maintaining aspect ratio
- Displays format information (dimensions, invoices per page)
- Includes preview legend for cut lines

### InvoicePreviewExample

Example component demonstrating how to use the preview with format selection.

**Features:**
- Integrates FormatSelector with InvoicePreview
- Provides toggle for showing/hiding cut lines
- Shows complete workflow for format selection and preview

## Usage

### Basic Usage

```tsx
import { InvoicePreview } from '@/components/invoice/invoice-preview';
import { InvoiceFormat } from '@/types/invoice';

function MyComponent() {
  return (
    <InvoicePreview
      format={InvoiceFormat.FULL_PAGE}
      showCutLines={true}
    />
  );
}
```

### With Format Selector

```tsx
import { useState } from 'react';
import { FormatSelector } from '@/components/invoice/format-selector';
import { InvoicePreview } from '@/components/invoice/invoice-preview';
import { InvoiceFormat } from '@/types/invoice';

function InvoiceGenerator() {
  const [format, setFormat] = useState(InvoiceFormat.FULL_PAGE);
  const [showCutLines, setShowCutLines] = useState(true);

  return (
    <div>
      <FormatSelector
        selectedFormat={format}
        onFormatChange={setFormat}
      />
      
      <label>
        <input
          type="checkbox"
          checked={showCutLines}
          onChange={(e) => setShowCutLines(e.target.checked)}
        />
        Show cut lines
      </label>

      <InvoicePreview
        format={format}
        showCutLines={showCutLines}
      />
    </div>
  );
}
```

### With Custom Sample Data

```tsx
import { InvoicePreview } from '@/components/invoice/invoice-preview';
import { InvoiceFormat, InvoiceData } from '@/types/invoice';

const customData: InvoiceData = {
  invoiceNumber: 'INV-2024-999',
  businessName: 'My Business',
  businessAddress: '123 Main St',
  businessPhone: '+1234567890',
  customerName: 'Customer Name',
  customerAddress: '456 Customer St',
  customerPhone: '+0987654321',
  amount: 10000,
  productName: 'Product',
  quantity: 1,
  discount: 0,
  createdAt: new Date(),
};

function MyComponent() {
  return (
    <InvoicePreview
      format={InvoiceFormat.HALF_PAGE}
      showCutLines={true}
      sampleData={customData}
    />
  );
}
```

## Preview Behavior by Format

### Full Page (1 per page)
- Shows single invoice with generous spacing
- No cut lines displayed
- Full A4 dimensions (210×297mm)

### Half Page (2 per page)
- Shows two invoices stacked vertically
- Horizontal cut line between invoices
- Each invoice is 210×148.5mm

### Quarter Page (4 per page)
- Shows four invoices in 2×2 grid
- Horizontal and vertical cut lines
- Each invoice is 105×148.5mm

## Styling

The preview component uses:
- Tailwind CSS for styling
- Inline styles for precise dimensions (mm units)
- CSS transform for scaling to fit screen
- Dark theme compatible (gray-700/800 backgrounds)

## Testing

To test the preview functionality:

1. Navigate to `/test/invoice-preview` in your browser
2. Select different formats using the format selector
3. Toggle cut lines on/off
4. Verify that preview updates correctly

## Integration

The preview component integrates with:
- `FormatSelector` - For format selection UI
- Invoice template components (`FullPageInvoice`, `HalfPageInvoice`, `QuarterPageInvoice`)
- `INVOICE_FORMAT_CONFIGS` - For format configuration data

## Requirements Satisfied

This component satisfies **Requirement 1.1**:
- ✅ Displays available format options
- ✅ Updates preview when format changes
- ✅ Shows cut lines in preview mode
- ✅ Displays sample data in preview
