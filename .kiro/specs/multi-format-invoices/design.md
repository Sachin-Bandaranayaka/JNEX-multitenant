# Design Document

## Overview

The multi-format invoice system extends the existing invoice generation functionality to support three distinct layout formats optimized for A4 paper: full-page (1 per sheet), half-page (2 per sheet), and quarter-page (4 per sheet). The system maintains all essential information (barcode, addresses, totals, phone numbers) across all formats while maximizing paper efficiency. The design leverages the existing tenant-based business information and order data structures, adding a format selection mechanism and new PDF generation logic.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Format Selector  │  │  Invoice Preview Components      │ │
│  │   Component      │  │  - FullPageInvoice               │ │
│  └──────────────────┘  │  - HalfPageInvoice               │ │
│                        │  - QuarterPageInvoice            │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Invoice Format Manager                       │   │
│  │  - Format validation                                 │   │
│  │  - Layout calculation                                │   │
│  │  - Multi-invoice batching                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PDF Generation Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Multi-Format PDF Generator                   │   │
│  │  - jsPDF integration                                 │   │
│  │  - Barcode generation (JsBarcode)                    │   │
│  │  - Layout rendering                                  │   │
│  │  - Page management                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │  Tenant Data     │  │  Order Data                  │    │
│  │  - businessName  │  │  - customerName              │    │
│  │  - businessAddr  │  │  - customerAddress           │    │
│  │  - businessPhone │  │  - amount, product, etc.     │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. User selects invoice format from UI
2. Format Selector updates user preference (stored in localStorage or user settings)
3. Invoice Preview Component renders appropriate template
4. On PDF generation request, Invoice Format Manager validates and prepares data
5. Multi-Format PDF Generator creates PDF with correct layout
6. PDF is returned to user for download/print

## Components and Interfaces

### 1. Invoice Format Types

```typescript
// src/types/invoice.ts

export enum InvoiceFormat {
  FULL_PAGE = 'FULL_PAGE',
  HALF_PAGE = 'HALF_PAGE',
  QUARTER_PAGE = 'QUARTER_PAGE',
}

export interface InvoiceFormatConfig {
  format: InvoiceFormat;
  invoicesPerPage: number;
  dimensions: {
    width: number;  // in mm
    height: number; // in mm
  };
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  barcodeSize: {
    width: number;
    height: number;
  };
  fontSize: {
    title: number;
    normal: number;
    small: number;
  };
}

export interface InvoiceData {
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

export interface BatchInvoiceRequest {
  invoices: InvoiceData[];
  format: InvoiceFormat;
}
```

### 2. Format Configuration

```typescript
// src/lib/invoice/format-configs.ts

export const INVOICE_FORMAT_CONFIGS: Record<InvoiceFormat, InvoiceFormatConfig> = {
  [InvoiceFormat.FULL_PAGE]: {
    format: InvoiceFormat.FULL_PAGE,
    invoicesPerPage: 1,
    dimensions: {
      width: 210,  // A4 width
      height: 297, // A4 height
    },
    margins: {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    },
    barcodeSize: {
      width: 80,
      height: 50,
    },
    fontSize: {
      title: 16,
      normal: 10,
      small: 8,
    },
  },
  [InvoiceFormat.HALF_PAGE]: {
    format: InvoiceFormat.HALF_PAGE,
    invoicesPerPage: 2,
    dimensions: {
      width: 210,
      height: 148.5, // A4 height / 2
    },
    margins: {
      top: 10,
      right: 15,
      bottom: 10,
      left: 15,
    },
    barcodeSize: {
      width: 60,
      height: 35,
    },
    fontSize: {
      title: 12,
      normal: 8,
      small: 7,
    },
  },
  [InvoiceFormat.QUARTER_PAGE]: {
    format: InvoiceFormat.QUARTER_PAGE,
    invoicesPerPage: 4,
    dimensions: {
      width: 105,  // A4 width / 2
      height: 148.5, // A4 height / 2
    },
    margins: {
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    },
    barcodeSize: {
      width: 45,
      height: 25,
    },
    fontSize: {
      title: 10,
      normal: 7,
      small: 6,
    },
  },
};
```

### 3. Format Selector Component

```typescript
// src/components/invoice/format-selector.tsx

interface FormatSelectorProps {
  selectedFormat: InvoiceFormat;
  onFormatChange: (format: InvoiceFormat) => void;
}

// Component allows users to select invoice format
// Displays visual preview of each format option
// Persists selection to localStorage
```

### 4. Invoice Template Components

```typescript
// src/components/invoice/templates/full-page-invoice.tsx
// src/components/invoice/templates/half-page-invoice.tsx
// src/components/invoice/templates/quarter-page-invoice.tsx

interface InvoiceTemplateProps {
  data: InvoiceData;
  config: InvoiceFormatConfig;
  showCutLines?: boolean;
}

// Each template component renders invoice in specific format
// Handles responsive sizing based on config
// Includes barcode rendering
// Displays all essential information
```

### 5. Multi-Format PDF Generator

```typescript
// src/lib/invoice/pdf-generator.ts

export class MultiFormatPDFGenerator {
  /**
   * Generates a PDF with one or more invoices in the specified format
   */
  async generatePDF(request: BatchInvoiceRequest): Promise<Buffer>;
  
  /**
   * Renders a single invoice on the PDF at specified position
   */
  private renderInvoice(
    doc: jsPDF,
    invoice: InvoiceData,
    config: InvoiceFormatConfig,
    position: { x: number; y: number }
  ): void;
  
  /**
   * Generates barcode as base64 image
   */
  private async generateBarcode(value: string, width: number, height: number): Promise<string>;
  
  /**
   * Draws cut lines between invoices
   */
  private drawCutLines(
    doc: jsPDF,
    format: InvoiceFormat,
    pageNumber: number
  ): void;
  
  /**
   * Calculates positions for multiple invoices on a page
   */
  private calculateInvoicePositions(format: InvoiceFormat): Array<{ x: number; y: number }>;
}
```

### 6. API Endpoints

```typescript
// src/app/api/invoices/generate/route.ts

// POST /api/invoices/generate
// Body: { invoices: InvoiceData[], format: InvoiceFormat }
// Returns: PDF file (application/pdf)

// GET /api/invoices/formats
// Returns: Available format configurations
```

## Data Models

### Existing Models (from Prisma schema)

The system leverages existing Prisma models:

- **Tenant**: Provides `businessName`, `businessAddress`, `businessPhone`
- **Order**: Provides customer information, product details, amounts
- **Product**: Provides product name and pricing

### New Data Structures

```typescript
// User preference storage (localStorage)
interface InvoicePreferences {
  defaultFormat: InvoiceFormat;
  lastUsedFormat: InvoiceFormat;
  showCutLines: boolean;
}

// Invoice generation request
interface GenerateInvoiceRequest {
  orderIds: string[];
  format: InvoiceFormat;
  tenantId: string;
}

// Invoice generation response
interface GenerateInvoiceResponse {
  success: boolean;
  pdfUrl?: string;
  error?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Prework Analysis


### Property Reflection

After reviewing all testable properties from the prework, several can be consolidated:

**Redundancies identified:**
- Properties 2.2, 2.3, 2.4, 2.5 (essential information display) can be combined into a single comprehensive property
- Properties 6.1, 6.2, 6.3 (tenant data retrieval) can be combined into one property
- Properties 4.3 and 5.3 (essential information in different formats) are covered by the combined essential information property
- Properties 7.2 and 9.1 (A4 dimensions and margins) can be combined

**Properties to keep as examples:**
- Format-specific tests (3.3, 3.4, 3.5, 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.4, 5.5) remain as examples since they test specific format configurations
- API response test (7.5) remains as example

### Correctness Properties

Property 1: Format selection generates correct layout
*For any* invoice data and selected format, generating an invoice should produce a PDF with dimensions and layout properties matching that format's configuration
**Validates: Requirements 1.2**

Property 2: Format preference persistence
*For any* format selection, saving the preference and then loading it should return the same format value
**Validates: Requirements 1.4**

Property 3: Barcode inclusion
*For any* invoice data and format, the generated PDF should contain a barcode representing the invoice number
**Validates: Requirements 2.1**

Property 4: Essential information completeness
*For any* invoice data and format, the generated invoice should display business name, business address, business phone, customer name, customer address, customer phone, total amount, and invoice number in human-readable format
**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

Property 5: Tenant data retrieval
*For any* tenant with business information (name, address, phone), generating an invoice should include all non-null tenant fields in the output
**Validates: Requirements 6.1, 6.2, 6.3**

Property 6: Missing tenant data handling
*For any* tenant field that is null, the generated invoice should display placeholder text instead of null or empty values
**Validates: Requirements 6.4**

Property 7: Tenant data update propagation
*For any* tenant, if business information is updated and a new invoice is generated, the new invoice should reflect the updated information
**Validates: Requirements 6.5**

Property 8: PDF format consistency
*For any* invoice generation request, the resulting PDF should have A4 page dimensions (210mm × 297mm) with appropriate margins
**Validates: Requirements 7.2, 9.1**

Property 9: Barcode vector embedding
*For any* generated PDF, the barcode should be embedded as a vector graphic (not raster image)
**Validates: Requirements 7.3**

Property 10: Batch grouping by format
*For any* list of invoices and selected format, the system should group them according to the format's invoicesPerPage value (1 for full-page, 2 for half-page, 4 for quarter-page)
**Validates: Requirements 8.1**

Property 11: Partial page handling
*For any* number of invoices that doesn't evenly divide by the format's invoicesPerPage value, the last page should contain the remaining invoices with blank spaces for unfilled positions
**Validates: Requirements 8.4**

Property 12: Multi-invoice single PDF
*For any* batch of invoices, the generation should produce exactly one PDF file with page count equal to ceiling(invoice_count / invoicesPerPage)
**Validates: Requirements 8.5**

Property 13: Print-safe font usage
*For any* generated invoice, all text should use standard print-safe fonts (Helvetica, Arial, or Times)
**Validates: Requirements 9.2**

Property 14: Cut line rendering
*For any* multi-invoice page, cut lines should be rendered as dashed lines positioned between invoice boundaries without overlapping content areas
**Validates: Requirements 9.4**

Property 15: Barcode white space
*For any* rendered barcode, there should be a minimum margin of 2mm on all sides to ensure scanning reliability
**Validates: Requirements 9.5**

## Error Handling

### Error Scenarios

1. **Missing Tenant Data**
   - Scenario: Tenant has null business information
   - Handling: Display placeholder text ("Your Company", "Your Address", etc.)
   - User feedback: None (graceful degradation)

2. **Invalid Format Selection**
   - Scenario: User selects unsupported format
   - Handling: Fall back to default (FULL_PAGE)
   - User feedback: Warning message in UI

3. **Barcode Generation Failure**
   - Scenario: Invalid invoice number or barcode library error
   - Handling: Log error, display invoice number as text only
   - User feedback: Warning that barcode could not be generated

4. **PDF Generation Failure**
   - Scenario: jsPDF throws error during generation
   - Handling: Catch error, return 500 status with error message
   - User feedback: Error toast with retry option

5. **Empty Invoice Batch**
   - Scenario: User attempts to generate PDF with no invoices
   - Handling: Return 400 status with validation error
   - User feedback: Error message "No invoices selected"

6. **Excessive Batch Size**
   - Scenario: User attempts to generate >100 invoices at once
   - Handling: Return 400 status with limit message
   - User feedback: Error message with batch size limit

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, any>;
}
```

### Validation Rules

- Invoice number: Required, non-empty string
- Customer name: Required, non-empty string
- Customer address: Required, non-empty string
- Customer phone: Required, valid phone format
- Amount: Required, positive number
- Format: Must be one of InvoiceFormat enum values
- Batch size: 1-100 invoices

## Testing Strategy

### Unit Testing

The system will use **Vitest** as the testing framework for unit tests.

**Unit test coverage:**

1. **Format Configuration Tests**
   - Verify each format config has correct dimensions
   - Verify barcode sizes are appropriate for each format
   - Verify font sizes scale appropriately

2. **Component Rendering Tests**
   - Test FormatSelector renders all format options
   - Test each invoice template renders with sample data
   - Test cut lines appear when showCutLines is true

3. **Utility Function Tests**
   - Test calculateInvoicePositions returns correct coordinates
   - Test format validation accepts valid formats and rejects invalid ones
   - Test preference persistence to localStorage

4. **API Endpoint Tests**
   - Test /api/invoices/generate returns PDF with correct content-type
   - Test error responses for invalid requests
   - Test batch size validation

5. **Edge Cases**
   - Empty strings in tenant data trigger placeholders
   - Very long addresses wrap correctly
   - Special characters in names render correctly

### Property-Based Testing

The system will use **fast-check** as the property-based testing library, configured to run a minimum of 100 iterations per property test.

**Property test implementation:**

Each property-based test will be tagged with a comment explicitly referencing the correctness property from this design document using the format: `**Feature: multi-format-invoices, Property {number}: {property_text}**`

Each correctness property will be implemented by a SINGLE property-based test.

**Test generators:**

```typescript
// Arbitrary generators for property tests
const invoiceDataArbitrary = fc.record({
  invoiceNumber: fc.string({ minLength: 1, maxLength: 20 }),
  businessName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  businessAddress: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  businessPhone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
  customerName: fc.string({ minLength: 1, maxLength: 50 }),
  customerAddress: fc.string({ minLength: 1, maxLength: 100 }),
  customerPhone: fc.string({ minLength: 10, maxLength: 15 }),
  amount: fc.float({ min: 0.01, max: 1000000 }),
  productName: fc.string({ minLength: 1, maxLength: 50 }),
  quantity: fc.integer({ min: 1, max: 100 }),
  discount: fc.float({ min: 0, max: 10000 }),
});

const formatArbitrary = fc.constantFrom(
  InvoiceFormat.FULL_PAGE,
  InvoiceFormat.HALF_PAGE,
  InvoiceFormat.QUARTER_PAGE
);

const invoiceBatchArbitrary = fc.array(invoiceDataArbitrary, { minLength: 1, maxLength: 20 });
```

**Property test examples:**

```typescript
// Property 1: Format selection generates correct layout
test('Property 1: Format selection generates correct layout', async () => {
  await fc.assert(
    fc.asyncProperty(invoiceDataArbitrary, formatArbitrary, async (invoiceData, format) => {
      const pdf = await generatePDF({ invoices: [invoiceData], format });
      const config = INVOICE_FORMAT_CONFIGS[format];
      
      // Verify PDF has correct dimensions
      expect(pdf.getPageDimensions()).toMatchObject({
        width: 210,
        height: 297,
      });
      
      // Verify layout properties match config
      // (implementation-specific checks)
    }),
    { numRuns: 100 }
  );
});

// Property 4: Essential information completeness
test('Property 4: Essential information completeness', async () => {
  await fc.assert(
    fc.asyncProperty(invoiceDataArbitrary, formatArbitrary, async (invoiceData, format) => {
      const pdfText = await generatePDFAndExtractText({ invoices: [invoiceData], format });
      
      // Verify all essential fields are present in the text
      expect(pdfText).toContain(invoiceData.businessName || 'Your Company');
      expect(pdfText).toContain(invoiceData.customerName);
      expect(pdfText).toContain(invoiceData.customerAddress);
      expect(pdfText).toContain(invoiceData.customerPhone);
      expect(pdfText).toContain(invoiceData.amount.toString());
      expect(pdfText).toContain(invoiceData.invoiceNumber);
    }),
    { numRuns: 100 }
  );
});
```

### Integration Testing

1. **End-to-End Invoice Generation**
   - Create order in database
   - Generate invoice via API
   - Verify PDF contains correct data
   - Verify PDF can be opened and printed

2. **Multi-Tenant Scenarios**
   - Generate invoices for different tenants
   - Verify each uses correct tenant branding
   - Verify tenant isolation

3. **Batch Processing**
   - Generate batch of 10 invoices in each format
   - Verify correct page count
   - Verify all invoices present in PDF

## Implementation Notes

### Technology Stack

- **PDF Generation**: jsPDF (already in use)
- **Barcode Generation**: JsBarcode (compatible with jsPDF)
- **Testing**: Vitest (unit tests), fast-check (property-based tests)
- **UI Framework**: React with TypeScript
- **Styling**: Tailwind CSS

### Performance Considerations

1. **Barcode Generation**: Generate barcodes asynchronously to avoid blocking
2. **Batch Processing**: Process invoices in chunks of 10 to avoid memory issues
3. **PDF Size**: Optimize barcode image size to keep PDFs under 1MB per 10 invoices
4. **Caching**: Cache format configurations to avoid repeated calculations

### Browser Compatibility

- Target modern browsers (Chrome, Firefox, Safari, Edge)
- PDF generation works in all browsers with jsPDF support
- Print functionality tested on major browsers

### Accessibility

- High contrast text for readability
- Minimum font size of 6pt (quarter-page format)
- Clear visual hierarchy in all formats
- Print-friendly color scheme (black text on white background)

### Migration Strategy

1. Keep existing invoice generation as fallback
2. Add format selector to UI with FULL_PAGE as default
3. Gradually roll out new formats to users
4. Monitor PDF generation success rates
5. Deprecate old invoice generation after 2 weeks of stable operation
