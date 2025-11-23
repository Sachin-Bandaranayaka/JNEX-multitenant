# Implementation Plan

- [x] 1. Create type definitions and format configurations
  - Define InvoiceFormat enum and related TypeScript interfaces
  - Create format configuration objects with dimensions, margins, and sizing for all three formats
  - Export format configs as constants
  - _Requirements: 1.3, 1.5, 3.1, 4.1, 5.1_

- [ ] 2. Implement barcode generation utility
  - Create utility function to generate barcode as base64 image using JsBarcode
  - Handle different barcode sizes based on format
  - Add error handling for invalid barcode values
  - Ensure minimum 2mm white space around barcodes
  - _Requirements: 2.1, 3.5, 4.4, 5.4, 9.5_

- [ ]* 2.1 Write property test for barcode generation
  - **Property 3: Barcode inclusion**
  - **Validates: Requirements 2.1**

- [ ]* 2.2 Write property test for barcode white space
  - **Property 15: Barcode white space**
  - **Validates: Requirements 9.5**

- [x] 3. Build multi-format PDF generator core
  - Create MultiFormatPDFGenerator class with jsPDF integration
  - Implement calculateInvoicePositions method for layout calculation
  - Implement renderInvoice method to render single invoice at specified position
  - Add support for A4 page dimensions and margins
  - Use print-safe fonts (Helvetica, Arial, Times)
  - _Requirements: 7.1, 7.2, 7.3, 9.1, 9.2_

- [ ]* 3.1 Write property test for PDF format consistency
  - **Property 8: PDF format consistency**
  - **Validates: Requirements 7.2, 9.1**

- [ ]* 3.2 Write property test for print-safe fonts
  - **Property 13: Print-safe font usage**
  - **Validates: Requirements 9.2**

- [ ]* 3.3 Write property test for barcode vector embedding
  - **Property 9: Barcode vector embedding**
  - **Validates: Requirements 7.3**

- [ ] 4. Implement invoice rendering for each format
  - Create renderFullPageInvoice method with generous spacing and itemized details
  - Create renderHalfPageInvoice method with compact layout
  - Create renderQuarterPageInvoice method with minimal spacing
  - Ensure all formats include essential information (business/customer details, total, invoice number)
  - Handle missing tenant data with placeholder text
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 4.3, 5.3, 6.4_

- [ ]* 4.1 Write property test for essential information completeness
  - **Property 4: Essential information completeness**
  - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

- [ ]* 4.2 Write property test for missing tenant data handling
  - **Property 6: Missing tenant data handling**
  - **Validates: Requirements 6.4**

- [x] 5. Add cut line rendering for multi-invoice pages
  - Implement drawCutLines method to render dashed lines between invoices
  - Calculate correct positions for half-page format (horizontal line at 148.5mm)
  - Calculate correct positions for quarter-page format (horizontal and vertical lines)
  - Ensure cut lines don't overlap content areas
  - _Requirements: 4.5, 5.5, 9.4_

- [ ]* 5.1 Write property test for cut line rendering
  - **Property 14: Cut line rendering**
  - **Validates: Requirements 9.4**

- [x] 6. Implement batch processing logic
  - Create generatePDF method that accepts BatchInvoiceRequest
  - Group invoices according to format density (1, 2, or 4 per page)
  - Handle partial pages by leaving blank spaces
  - Generate single PDF with multiple pages as needed
  - Calculate correct page count: ceiling(invoice_count / invoicesPerPage)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 6.1 Write property test for batch grouping
  - **Property 10: Batch grouping by format**
  - **Validates: Requirements 8.1**

- [ ]* 6.2 Write property test for partial page handling
  - **Property 11: Partial page handling**
  - **Validates: Requirements 8.4**

- [ ]* 6.3 Write property test for multi-invoice single PDF
  - **Property 12: Multi-invoice single PDF**
  - **Validates: Requirements 8.5**

- [x] 7. Create tenant data integration
  - Fetch tenant business information from database
  - Map tenant fields to invoice data structure
  - Ensure updates to tenant data reflect in new invoices
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ]* 7.1 Write property test for tenant data retrieval
  - **Property 5: Tenant data retrieval**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ]* 7.2 Write property test for tenant data update propagation
  - **Property 7: Tenant data update propagation**
  - **Validates: Requirements 6.5**

- [x] 8. Build format selector UI component
  - Create FormatSelector component with radio buttons or dropdown
  - Display visual preview icons for each format
  - Show format descriptions (1 per page, 2 per page, 4 per page)
  - Emit format change events to parent component
  - _Requirements: 1.1_

- [x] 9. Implement format preference persistence
  - Create utility to save selected format to localStorage
  - Create utility to load saved format preference
  - Set FULL_PAGE as default when no preference exists
  - Apply saved preference on component mount
  - _Requirements: 1.4_

- [ ]* 9.1 Write property test for format preference persistence
  - **Property 2: Format preference persistence**
  - **Validates: Requirements 1.4**

- [x] 10. Create invoice template components
  - Build FullPageInvoice React component
  - Build HalfPageInvoice React component
  - Build QuarterPageInvoice React component
  - Each component accepts InvoiceData and config props
  - Add showCutLines prop for preview mode
  - _Requirements: 3.1, 4.1, 5.1_

- [x] 11. Build API endpoint for invoice generation
  - Create POST /api/invoices/generate endpoint
  - Accept BatchInvoiceRequest in request body
  - Validate invoice data and format
  - Validate batch size (1-100 invoices)
  - Call MultiFormatPDFGenerator to create PDF
  - Return PDF with correct content-type headers
  - Handle errors with appropriate status codes and messages
  - _Requirements: 7.5_

- [ ]* 11.1 Write unit tests for API endpoint
  - Test successful PDF generation returns 200 with PDF content-type
  - Test invalid format returns 400 error
  - Test empty batch returns 400 error
  - Test excessive batch size returns 400 error
  - Test missing required fields returns 400 error
  - _Requirements: 7.5_

- [x] 12. Integrate format selector into existing invoice UI
  - Add FormatSelector to invoice generation page
  - Wire up format selection to PDF generation
  - Update existing invoice buttons to use new multi-format generator
  - Maintain backward compatibility with existing invoice code
  - _Requirements: 1.2_

- [ ]* 12.1 Write property test for format selection
  - **Property 1: Format selection generates correct layout**
  - **Validates: Requirements 1.2**

- [x] 13. Add invoice preview functionality
  - Create preview component that renders selected format
  - Update preview when format changes
  - Show cut lines in preview mode
  - Display sample data in preview
  - _Requirements: 1.1_

- [x] 14. Implement error handling and validation
  - Add validation for required invoice fields
  - Handle barcode generation failures gracefully
  - Handle PDF generation errors with user-friendly messages
  - Add error boundaries to React components
  - Log errors for debugging
  - _Requirements: All error handling scenarios_

- [ ]* 14.1 Write unit tests for error scenarios
  - Test missing tenant data shows placeholders
  - Test invalid format falls back to FULL_PAGE
  - Test barcode generation failure shows text only
  - Test PDF generation failure returns 500 error
  - Test empty batch validation
  - Test excessive batch size validation
  - _Requirements: Error handling_

- [-] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Update existing invoice generation flows
  - Update order detail page to use new format selector
  - Update bulk invoice generation to support format selection
  - Migrate existing invoice print button to use new generator
  - Test with real order data from database
  - _Requirements: Integration with existing system_

- [x] 17. Add format configuration endpoint
  - Create GET /api/invoices/formats endpoint
  - Return available format configurations
  - Include format metadata (name, description, invoicesPerPage)
  - _Requirements: 1.1_

- [ ]* 17.1 Write unit test for formats endpoint
  - Test endpoint returns all three formats
  - Test response includes correct format metadata
  - _Requirements: 1.1_

- [ ] 18. Performance optimization
  - Implement barcode generation caching
  - Process large batches in chunks of 10
  - Optimize PDF size by compressing barcode images
  - Add loading indicators for PDF generation
  - _Requirements: Performance considerations_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
