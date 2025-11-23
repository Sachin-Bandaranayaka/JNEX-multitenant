# Invoice System Error Handling Guide

## Overview

The multi-format invoice system includes comprehensive error handling and validation to ensure data integrity, provide clear user feedback, and facilitate debugging. This guide explains how to use the error handling features.

## Components

### 1. Validation Module

Located at: `src/lib/invoice/validation.ts`

#### Basic Usage

```typescript
import { validateInvoiceData, validateBatchInvoiceRequest } from '@/lib/invoice/validation';

// Validate a single invoice
const invoice: InvoiceData = { /* ... */ };
const result = validateInvoiceData(invoice);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
  // Handle errors
}

// Validate a batch request
const validation = validateBatchInvoiceRequest(invoices, format);
if (!validation.isValid) {
  const errorMessage = formatValidationErrors(validation.errors);
  // Display error to user
}
```

#### Validation Functions

- `isValidPhoneNumber(phone: string)` - Validates phone number format
- `isValidInvoiceNumber(invoiceNumber: string)` - Validates invoice number
- `isNonEmptyString(value: string)` - Checks for non-empty strings
- `isPositiveNumber(value: number)` - Checks for positive numbers
- `isNonNegativeNumber(value: number)` - Checks for non-negative numbers
- `validateInvoiceData(invoice: InvoiceData)` - Validates complete invoice
- `validateBatchInvoiceRequest(invoices, format)` - Validates batch request
- `formatValidationErrors(errors)` - Formats errors for display

### 2. Error Boundary Component

Located at: `src/components/invoice/invoice-error-boundary.tsx`

#### Basic Usage

```typescript
import { InvoiceErrorBoundary } from '@/components/invoice/invoice-error-boundary';

function MyComponent() {
  return (
    <InvoiceErrorBoundary>
      <InvoicePreview format={format} />
    </InvoiceErrorBoundary>
  );
}
```

#### With Custom Fallback

```typescript
<InvoiceErrorBoundary
  fallback={
    <div className="error-message">
      Custom error UI
    </div>
  }
>
  <InvoicePreview format={format} />
</InvoiceErrorBoundary>
```

#### With Error Callback

```typescript
<InvoiceErrorBoundary
  onError={(error, errorInfo) => {
    // Send to monitoring service
    console.error('Component error:', error);
    // Sentry.captureException(error);
  }}
>
  <InvoicePreview format={format} />
</InvoiceErrorBoundary>
```

### 3. Error Logger

Located at: `src/lib/invoice/error-logger.ts`

#### Basic Usage

```typescript
import { invoiceLogger } from '@/lib/invoice/error-logger';

// Log info
invoiceLogger.info('PDF generation started', {
  component: 'PDFGenerator',
  format: 'FULL_PAGE',
  invoiceCount: 5,
});

// Log warning
invoiceLogger.warn('Barcode generation failed, using fallback', {
  component: 'BarcodeGenerator',
  invoiceId: 'INV-001',
});

// Log error
invoiceLogger.error('PDF generation failed', error, {
  component: 'PDFGenerator',
  action: 'generatePDF',
  format: 'FULL_PAGE',
});

// Log critical error
invoiceLogger.critical('Database connection lost', error, {
  component: 'TenantDataFetcher',
  tenantId: 'tenant-123',
});
```

#### Advanced Usage

```typescript
import { InvoiceErrorLogger, ErrorSeverity } from '@/lib/invoice/error-logger';

const logger = InvoiceErrorLogger.getInstance();

// Get recent logs
const recentLogs = logger.getRecentLogs(10);

// Get all logs
const allLogs = logger.getAllLogs();

// Clear logs
logger.clearLogs();

// Custom log with full control
logger.log(
  ErrorSeverity.ERROR,
  'Custom error message',
  error,
  {
    component: 'MyComponent',
    customField: 'customValue',
  }
);
```

## Error Handling Patterns

### 1. API Route Error Handling

```typescript
export async function POST(request: Request) {
  try {
    // Parse JSON with error handling
    let json: any;
    try {
      json = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateBatchInvoiceRequest(json.invoices, json.format);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: formatValidationErrors(validation.errors),
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Process request
    const result = await processInvoices(json);
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    // Log error
    invoiceLogger.error('Request processing failed', error, {
      component: 'APIRoute',
      action: 'POST',
    });

    // Return user-friendly error
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred. Please try again.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
```

### 2. Component Error Handling

```typescript
function InvoiceComponent({ format }: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePDF = async () => {
    try {
      setError(null);
      
      // Validate format
      if (!isValidFormat(format)) {
        setError('Invalid format selected');
        return;
      }

      // Generate PDF
      const pdf = await generatePDF({ invoices, format });
      
      // Success
      downloadPDF(pdf);
      
    } catch (err) {
      // Log error
      invoiceLogger.error('PDF generation failed', err, {
        component: 'InvoiceComponent',
        format,
      });

      // Show user-friendly message
      setError('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <InvoiceErrorBoundary>
      <div>
        {error && <ErrorMessage message={error} />}
        <button onClick={handleGeneratePDF}>Generate PDF</button>
      </div>
    </InvoiceErrorBoundary>
  );
}
```

### 3. Graceful Degradation

```typescript
function renderInvoice(invoice: InvoiceData) {
  try {
    // Try to generate barcode
    const barcode = generateBarcode(invoice.invoiceNumber);
    return <InvoiceWithBarcode invoice={invoice} barcode={barcode} />;
  } catch (error) {
    // Log warning
    invoiceLogger.warn('Barcode generation failed, using text fallback', {
      component: 'InvoiceRenderer',
      invoiceId: invoice.invoiceNumber,
    });

    // Fallback to text-only
    return <InvoiceWithText invoice={invoice} />;
  }
}
```

## Error Response Format

All API errors follow this structure:

```typescript
{
  success: false,
  error: "User-friendly error message",
  code: "ERROR_CODE",
  details?: {
    // Additional context (optional)
  }
}
```

### Error Codes

- `UNAUTHORIZED` - Authentication required
- `INVALID_JSON` - Request body is not valid JSON
- `VALIDATION_ERROR` - Data validation failed
- `EMPTY_BATCH` - No invoices provided
- `BATCH_SIZE_EXCEEDED` - Too many invoices (>100)
- `PDF_GENERATION_ERROR` - PDF creation failed
- `INTERNAL_ERROR` - Unexpected server error

## Validation Rules

### Invoice Data

| Field | Required | Validation |
|-------|----------|------------|
| invoiceNumber | Yes | Alphanumeric, hyphens, underscores only |
| customerName | Yes | Non-empty string |
| customerAddress | Yes | Non-empty string |
| customerPhone | Yes | Valid phone format |
| customerSecondPhone | No | Valid phone format if provided |
| amount | Yes | Positive number |
| productName | Yes | Non-empty string |
| quantity | Yes | Positive integer |
| discount | Yes | Non-negative number |
| businessName | No | Nullable |
| businessAddress | No | Nullable |
| businessPhone | No | Nullable |

### Batch Request

- **Format**: Must be valid InvoiceFormat enum value
- **Batch Size**: 1-100 invoices
- **Invoices**: Must be array of valid InvoiceData objects

### Phone Number Formats

Accepted formats:
- `+94771234567`
- `0771234567`
- `077-123-4567`
- `077 123 4567`
- `+1 (555) 123-4567`

## Best Practices

### 1. Always Validate Input

```typescript
// ✅ Good
const validation = validateInvoiceData(invoice);
if (!validation.isValid) {
  handleErrors(validation.errors);
  return;
}
processInvoice(invoice);

// ❌ Bad
processInvoice(invoice); // No validation
```

### 2. Provide User-Friendly Messages

```typescript
// ✅ Good
return {
  error: 'Please enter a valid phone number (e.g., +94771234567)',
  code: 'INVALID_PHONE',
};

// ❌ Bad
return {
  error: 'Validation failed',
  code: 'ERROR',
};
```

### 3. Log with Context

```typescript
// ✅ Good
invoiceLogger.error('PDF generation failed', error, {
  component: 'PDFGenerator',
  action: 'generatePDF',
  format: 'FULL_PAGE',
  invoiceCount: 5,
  userId: user.id,
});

// ❌ Bad
console.error('Error:', error);
```

### 4. Use Error Boundaries

```typescript
// ✅ Good
<InvoiceErrorBoundary>
  <ComplexInvoiceComponent />
</InvoiceErrorBoundary>

// ❌ Bad
<ComplexInvoiceComponent /> // No error boundary
```

### 5. Handle Async Errors

```typescript
// ✅ Good
try {
  const result = await asyncOperation();
  return result;
} catch (error) {
  invoiceLogger.error('Async operation failed', error);
  throw new Error('User-friendly message');
}

// ❌ Bad
const result = await asyncOperation(); // No error handling
```

## Testing Error Handling

### Validation Tests

```typescript
import { validateInvoiceData } from '@/lib/invoice/validation';

describe('Invoice Validation', () => {
  it('should reject invalid phone number', () => {
    const invoice = { ...validInvoice, customerPhone: 'invalid' };
    const result = validateInvoiceData(invoice);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'customerPhone')).toBe(true);
  });
});
```

### Error Boundary Tests

```typescript
import { InvoiceErrorBoundary } from '@/components/invoice/invoice-error-boundary';

describe('Error Boundary', () => {
  it('should catch and display errors', () => {
    const ThrowError = () => { throw new Error('Test'); };
    
    render(
      <InvoiceErrorBoundary>
        <ThrowError />
      </InvoiceErrorBoundary>
    );
    
    expect(screen.getByText('Invoice Display Error')).toBeDefined();
  });
});
```

## Monitoring and Debugging

### View Recent Logs

```typescript
import { getInvoiceLogger } from '@/lib/invoice/error-logger';

const logger = getInvoiceLogger();
const recentLogs = logger.getRecentLogs(20);

console.table(recentLogs.map(log => ({
  time: log.timestamp,
  severity: log.severity,
  message: log.message,
  component: log.context?.component,
})));
```

### Export Logs

```typescript
const allLogs = logger.getAllLogs();
const logsJSON = JSON.stringify(allLogs, null, 2);

// Download or send to monitoring service
downloadFile('invoice-logs.json', logsJSON);
```

### Integration with Monitoring Services

```typescript
import * as Sentry from '@sentry/nextjs';

invoiceLogger.critical('Critical error occurred', error, {
  component: 'PDFGenerator',
  userId: user.id,
});

// Send to Sentry
Sentry.captureException(error, {
  tags: {
    component: 'PDFGenerator',
    feature: 'invoice-generation',
  },
  extra: {
    userId: user.id,
  },
});
```

## Troubleshooting

### Common Issues

1. **Validation fails but data looks correct**
   - Check for whitespace in strings
   - Verify phone number format
   - Ensure numbers are not strings

2. **Error boundary not catching errors**
   - Error boundaries only catch errors in child components
   - They don't catch errors in event handlers
   - Use try-catch in event handlers

3. **Logs not appearing**
   - Check console for suppressed logs
   - Verify logger is imported correctly
   - Ensure log level is appropriate

4. **PDF generation fails silently**
   - Check browser console for errors
   - Verify all required fields are present
   - Check network tab for API errors

## Support

For issues or questions about error handling:
1. Check the logs using `getInvoiceLogger().getRecentLogs()`
2. Review validation errors in detail
3. Check browser console for client-side errors
4. Review server logs for API errors
5. Consult this documentation for patterns and best practices
