# Multi-Format Invoice Integration

## Overview

The multi-format invoice system has been successfully integrated into the existing invoice UI. Users can now select from three invoice formats (Full Page, Half Page, Quarter Page) and generate PDFs with their preferred layout.

## Integration Points

### 1. Print Page (`/orders/print`)

**Location**: `src/app/(authenticated)/orders/print/print-client.tsx`

**Features Added**:
- Format selector component with visual previews
- PDF generation button that uses the new multi-format API
- Format preference persistence (saved to localStorage)
- Backward compatibility with existing browser print functionality

**User Flow**:
1. User navigates to `/orders/print?ids=order1,order2,...`
2. User sees the format selector at the top of the page
3. User selects their preferred format (Full Page, Half Page, or Quarter Page)
4. User clicks "Generate PDF" to download a formatted PDF
5. Alternatively, user can still use "Print Selected" for browser-based printing

### 2. Orders List Page

**Location**: `src/app/(authenticated)/orders/orders-client.tsx`

**Integration**: 
- Existing "Print Selected" button links to the print page
- Selected order IDs are passed via URL query parameters
- No changes needed - automatically benefits from new format selector

### 3. Single Order Detail Page

**Location**: `src/app/(authenticated)/orders/[orderId]/page.tsx`

**Integration**:
- Maintains existing simple print functionality
- Uses the legacy Invoice component for single-order printing
- No format selector needed for single orders (backward compatibility)

## API Endpoint

**Endpoint**: `POST /api/invoices/generate`

**Request Body**:
```json
{
  "invoices": [
    {
      "invoiceNumber": "INV-001",
      "businessName": "Company Name",
      "businessAddress": "123 Street",
      "businessPhone": "555-1234",
      "customerName": "John Doe",
      "customerAddress": "456 Avenue",
      "customerPhone": "555-5678",
      "amount": 1000,
      "productName": "Product A",
      "quantity": 2,
      "discount": 50,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "format": "FULL_PAGE"
}
```

**Response**: PDF file (application/pdf)

## Backward Compatibility

The integration maintains full backward compatibility:

1. **Existing Print Functionality**: The browser's native print dialog still works
2. **Single Order View**: Individual order pages continue to use the simple Invoice component
3. **Legacy Code**: No existing invoice generation code was removed or broken
4. **Gradual Adoption**: Users can choose between PDF generation and browser printing

## Format Options

### Full Page (1 per page)
- Best for detailed invoices
- Generous spacing and large fonts
- Includes all product details and notes

### Half Page (2 per page)
- Balanced between detail and efficiency
- Compact layout with essential information
- Includes horizontal cut lines

### Quarter Page (4 per page)
- Maximum paper efficiency
- Minimal spacing with all essential info
- Includes horizontal and vertical cut lines

## User Preferences

Format preferences are automatically saved to localStorage and restored on subsequent visits. The default format is Full Page if no preference exists.

## Testing

All existing tests continue to pass. The integration has been verified to:
- Load without TypeScript errors
- Maintain existing functionality
- Add new PDF generation capability
- Persist user preferences correctly
