# Invoice Components

This directory contains components for invoice generation and management.

## FormatSelector Component

The `FormatSelector` component allows users to select from three invoice format options optimized for A4 paper.

### Features

- **Visual Preview Icons**: Each format displays a visual representation of the layout
- **Format Descriptions**: Clear descriptions showing invoices per page (1, 2, or 4)
- **Dimension Information**: Displays the exact dimensions for each format
- **Accessible**: Proper ARIA labels and keyboard navigation support
- **Responsive**: Works on mobile and desktop devices

### Usage

```tsx
import { FormatSelector } from '@/components/invoice/format-selector';
import { InvoiceFormat } from '@/types/invoice';
import { useState } from 'react';

function InvoiceGenerationPage() {
  const [format, setFormat] = useState<InvoiceFormat>(InvoiceFormat.FULL_PAGE);

  return (
    <FormatSelector
      selectedFormat={format}
      onFormatChange={setFormat}
    />
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedFormat` | `InvoiceFormat` | Yes | The currently selected invoice format |
| `onFormatChange` | `(format: InvoiceFormat) => void` | Yes | Callback function called when format changes |
| `className` | `string` | No | Additional CSS classes to apply to the root element |

### Available Formats

1. **Full Page** (`InvoiceFormat.FULL_PAGE`)
   - 1 invoice per A4 page
   - Dimensions: 210×297mm
   - Best for: Detailed invoices with itemized lists

2. **Half Page** (`InvoiceFormat.HALF_PAGE`)
   - 2 invoices per A4 page
   - Dimensions: 210×148.5mm each
   - Best for: Standard invoices with moderate detail

3. **Quarter Page** (`InvoiceFormat.QUARTER_PAGE`)
   - 4 invoices per A4 page
   - Dimensions: 105×148.5mm each
   - Best for: Compact invoices for high-volume printing

### Integration Example

See `format-selector-example.tsx` for a complete integration example showing:
- State management
- Format change handling
- Display of selected format
- Integration with other UI components

### Styling

The component uses Tailwind CSS classes and follows the application's design system:
- Dark theme compatible
- Hover and focus states
- Selected state highlighting
- Responsive grid layout

### Accessibility

- All buttons have descriptive `aria-label` attributes
- Selected state indicated with `aria-pressed`
- Keyboard navigable
- Screen reader friendly

### Testing

Unit tests are available in `__tests__/format-selector.test.tsx` covering:
- Format configuration validation
- Component export verification
- TypeScript type checking
- Enum value support
