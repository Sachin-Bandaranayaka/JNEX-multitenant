// src/lib/invoice/__tests__/cut-lines-visual-test.ts
// Visual test to verify cut lines are rendered correctly
// This test generates sample PDFs that can be manually inspected

import { MultiFormatPDFGenerator } from '../pdf-generator';
import { InvoiceFormat, InvoiceData, BatchInvoiceRequest } from '@/types/invoice';
import { writeFileSync } from 'fs';
import { join } from 'path';

const sampleInvoice: InvoiceData = {
  invoiceNumber: 'INV-001',
  businessName: 'Test Business',
  businessAddress: '123 Business St, City, State 12345',
  businessPhone: '555-0100',
  customerName: 'John Doe',
  customerAddress: '456 Customer Ave, City, State 67890',
  customerPhone: '555-0200',
  amount: 100.00,
  productName: 'Test Product',
  quantity: 2,
  discount: 10.00,
  createdAt: new Date('2024-01-01'),
};

async function generateTestPDFs() {
  console.log('Generating test PDFs with cut lines...');

  // Test 1: Half-page format with 2 invoices (should show horizontal cut line)
  const halfPageGenerator = new MultiFormatPDFGenerator();
  const halfPageRequest: BatchInvoiceRequest = {
    invoices: [
      sampleInvoice,
      { ...sampleInvoice, invoiceNumber: 'INV-002' },
    ],
    format: InvoiceFormat.HALF_PAGE,
  };
  const halfPagePdf = await halfPageGenerator.generatePDF(halfPageRequest);
  writeFileSync(join(__dirname, 'test-half-page-cut-lines.pdf'), halfPagePdf);
  console.log('✓ Generated test-half-page-cut-lines.pdf');

  // Test 2: Quarter-page format with 4 invoices (should show horizontal and vertical cut lines)
  const quarterPageGenerator = new MultiFormatPDFGenerator();
  const quarterPageRequest: BatchInvoiceRequest = {
    invoices: [
      sampleInvoice,
      { ...sampleInvoice, invoiceNumber: 'INV-002' },
      { ...sampleInvoice, invoiceNumber: 'INV-003' },
      { ...sampleInvoice, invoiceNumber: 'INV-004' },
    ],
    format: InvoiceFormat.QUARTER_PAGE,
  };
  const quarterPagePdf = await quarterPageGenerator.generatePDF(quarterPageRequest);
  writeFileSync(join(__dirname, 'test-quarter-page-cut-lines.pdf'), quarterPagePdf);
  console.log('✓ Generated test-quarter-page-cut-lines.pdf');

  // Test 3: Full-page format (should have NO cut lines)
  const fullPageGenerator = new MultiFormatPDFGenerator();
  const fullPageRequest: BatchInvoiceRequest = {
    invoices: [sampleInvoice],
    format: InvoiceFormat.FULL_PAGE,
  };
  const fullPagePdf = await fullPageGenerator.generatePDF(fullPageRequest);
  writeFileSync(join(__dirname, 'test-full-page-no-cut-lines.pdf'), fullPagePdf);
  console.log('✓ Generated test-full-page-no-cut-lines.pdf');

  console.log('\nTest PDFs generated successfully!');
  console.log('Please manually inspect the PDFs to verify:');
  console.log('1. Half-page PDF has a horizontal dashed line at 148.5mm');
  console.log('2. Quarter-page PDF has both horizontal and vertical dashed lines');
  console.log('3. Full-page PDF has no cut lines');
  console.log('4. Cut lines do not overlap with invoice content');
}

// Run if executed directly
if (require.main === module) {
  generateTestPDFs().catch(console.error);
}

export { generateTestPDFs };
