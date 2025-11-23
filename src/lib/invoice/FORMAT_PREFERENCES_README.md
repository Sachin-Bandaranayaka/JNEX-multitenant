# Invoice Format Preference Persistence

This module provides utilities for persisting user's invoice format preferences to localStorage.

## Features

- **Save Format Preference**: Saves the selected invoice format to localStorage
- **Load Format Preference**: Loads the saved format, defaulting to FULL_PAGE if none exists
- **Clear Preference**: Removes the saved preference
- **Default Format**: Returns the default format (FULL_PAGE)

## Usage

### Basic Usage

```typescript
import {
  saveFormatPreference,
  loadFormatPreference,
  clearFormatPreference,
  getDefaultFormat,
} from '@/lib/invoice/format-preferences';
import { InvoiceFormat } from '@/types/invoice';

// Save a format preference
saveFormatPreference(InvoiceFormat.HALF_PAGE);

// Load the saved preference (returns FULL_PAGE if none exists)
const format = loadFormatPreference();

// Clear the saved preference
clearFormatPreference();

// Get the default format
const defaultFormat = getDefaultFormat(); // Returns FULL_PAGE
```

### Integration with FormatSelector Component

The `FormatSelector` component automatically handles format persistence:

```typescript
import { FormatSelector } from '@/components/invoice/format-selector';
import { InvoiceFormat } from '@/types/invoice';

function MyComponent() {
  const [format, setFormat] = useState<InvoiceFormat>(InvoiceFormat.FULL_PAGE);

  return (
    <FormatSelector
      selectedFormat={format}
      onFormatChange={setFormat}
    />
  );
}
```

When the component mounts:
1. It loads the saved preference from localStorage
2. If a preference exists and differs from the current selection, it updates the format
3. When the user selects a new format, it automatically saves to localStorage

## Implementation Details

### Storage Key

The preference is stored in localStorage under the key: `invoice_format_preference`

### Default Behavior

- **Default Format**: `FULL_PAGE` (1 invoice per page)
- **No Preference**: Returns `FULL_PAGE` when no preference is saved
- **Invalid Format**: Returns `FULL_PAGE` if an invalid format is stored
- **Server-Side**: Returns `FULL_PAGE` when localStorage is unavailable (SSR)

### Error Handling

All functions handle errors gracefully:
- `saveFormatPreference`: Returns `false` on error, logs to console
- `loadFormatPreference`: Returns default format on error, logs to console
- `clearFormatPreference`: Returns `false` on error, logs to console

### Browser Compatibility

Works in all modern browsers that support localStorage:
- Chrome, Firefox, Safari, Edge
- Falls back gracefully in server-side rendering environments

## Testing

Comprehensive unit tests are available in:
- `src/lib/invoice/__tests__/format-preferences.test.ts`

Tests cover:
- Saving and loading all format types
- Default behavior when no preference exists
- Invalid format handling
- Error scenarios
- Round-trip persistence

## Requirements

Implements requirement 1.4 from the multi-format-invoices specification:
> "WHEN a format is selected THEN the Invoice System SHALL persist the user's preference for future invoices"
