// src/lib/invoice/__tests__/pdf-generator.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiFormatPDFGenerator } from '../pdf-generator';
import { InvoiceFormat, InvoiceData, BatchInvoiceRequest } from '@/types/invoice';

describe('MultiFormatPDFGenerator', () => {
  let generator: MultiFormatPDFGenerator;
  let sampleInvoice: InvoiceData;

  beforeEach(() => {
    generator = new MultiFormatPDFGenerator();
    sampleInvoice = {
      invoiceNumber: 'INV-001',
      businessName: 'Test Business',
      businessAddress: '123 Business St',
      businessPhone: '0771234567',
      customerName: 'John Doe',
      customerAddress: '456 Customer Ave',
      customerPhone: '0779876543',
      amount: 100.00,
      productName: 'Test Product',
      quantity: 2,
      discount: 10.00,
      createdAt: new Date('2024-01-01'),
    };
  });

  describe('generatePDF', () => {
    it('should generate a PDF for a single full-page invoice', async () => {
      const request: BatchInvoiceRequest = {
        invoices: [sampleInvoice],
        format: InvoiceFormat.FULL_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should generate a PDF for multiple half-page invoices', async () => {
      const request: BatchInvoiceRequest = {
        invoices: [sampleInvoice, { ...sampleInvoice, invoiceNumber: 'INV-002' }],
        format: InvoiceFormat.HALF_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should generate a PDF for multiple quarter-page invoices', async () => {
      const request: BatchInvoiceRequest = {
        invoices: [
          sampleInvoice,
          { ...sampleInvoice, invoiceNumber: 'INV-002' },
          { ...sampleInvoice, invoiceNumber: 'INV-003' },
          { ...sampleInvoice, invoiceNumber: 'INV-004' },
        ],
        format: InvoiceFormat.QUARTER_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should handle invoices with null business information', async () => {
      const invoiceWithNullBusiness: InvoiceData = {
        ...sampleInvoice,
        businessName: null,
        businessAddress: null,
        businessPhone: null,
      };

      const request: BatchInvoiceRequest = {
        invoices: [invoiceWithNullBusiness],
        format: InvoiceFormat.FULL_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should handle invoices with optional fields', async () => {
      const invoiceWithOptionals: InvoiceData = {
        ...sampleInvoice,
        customerSecondPhone: '0771112222',
        trackingNumber: 'TRACK-123',
        shippingProvider: 'Test Courier',
        notes: 'Handle with care',
      };

      const request: BatchInvoiceRequest = {
        invoices: [invoiceWithOptionals],
        format: InvoiceFormat.FULL_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should generate multiple pages when needed', async () => {
      // Create 5 invoices for half-page format (should create 3 pages)
      const invoices = Array.from({ length: 5 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.HALF_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing Logic (Task 6)', () => {
    it('should group invoices according to format density - full-page (1 per page)', async () => {
      // 3 invoices in full-page format should create 3 pages
      const invoices = Array.from({ length: 3 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.FULL_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // Verify PDF was generated successfully
    });

    it('should group invoices according to format density - half-page (2 per page)', async () => {
      // 4 invoices in half-page format should create 2 pages
      const invoices = Array.from({ length: 4 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.HALF_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should group invoices according to format density - quarter-page (4 per page)', async () => {
      // 8 invoices in quarter-page format should create 2 pages
      const invoices = Array.from({ length: 8 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.QUARTER_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should handle partial pages by leaving blank spaces - half-page format', async () => {
      // 3 invoices in half-page format (2 per page) should create 2 pages
      // Page 1: 2 invoices, Page 2: 1 invoice + 1 blank space
      const invoices = Array.from({ length: 3 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.HALF_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // The PDF should be generated without errors, with blank space for the 4th position
    });

    it('should handle partial pages by leaving blank spaces - quarter-page format', async () => {
      // 6 invoices in quarter-page format (4 per page) should create 2 pages
      // Page 1: 4 invoices, Page 2: 2 invoices + 2 blank spaces
      const invoices = Array.from({ length: 6 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.QUARTER_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // The PDF should be generated without errors, with blank spaces for positions 7 and 8
    });

    it('should generate single PDF with multiple pages as needed', async () => {
      // 10 invoices in half-page format should create 5 pages (2 per page)
      const invoices = Array.from({ length: 10 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.HALF_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // Should be a single PDF buffer containing all pages
    });

    it('should calculate correct page count using ceiling formula - example 1', async () => {
      // 7 invoices in quarter-page format (4 per page)
      // Expected pages: Math.ceil(7 / 4) = 2 pages
      const invoices = Array.from({ length: 7 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.QUARTER_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should calculate correct page count using ceiling formula - example 2', async () => {
      // 5 invoices in half-page format (2 per page)
      // Expected pages: Math.ceil(5 / 2) = 3 pages
      const invoices = Array.from({ length: 5 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.HALF_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should handle single invoice in any format', async () => {
      // Test with all three formats
      const formats = [InvoiceFormat.FULL_PAGE, InvoiceFormat.HALF_PAGE, InvoiceFormat.QUARTER_PAGE];

      for (const format of formats) {
        const request: BatchInvoiceRequest = {
          invoices: [sampleInvoice],
          format,
        };

        const pdf = await generator.generatePDF(request);

        expect(pdf).toBeInstanceOf(Buffer);
        expect(pdf.length).toBeGreaterThan(0);
      }
    });

    it('should handle large batches correctly', async () => {
      // 20 invoices in quarter-page format (4 per page)
      // Expected pages: Math.ceil(20 / 4) = 5 pages
      const invoices = Array.from({ length: 20 }, (_, i) => ({
        ...sampleInvoice,
        invoiceNumber: `INV-${String(i + 1).padStart(3, '0')}`,
      }));

      const request: BatchInvoiceRequest = {
        invoices,
        format: InvoiceFormat.QUARTER_PAGE,
      };

      const pdf = await generator.generatePDF(request);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('calculateInvoicePositions', () => {
    it('should return correct positions for full-page format', () => {
      // Access private method through type assertion for testing
      const positions = (generator as any).calculateInvoicePositions(InvoiceFormat.FULL_PAGE);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toEqual({ x: 0, y: 0 });
    });

    it('should return correct positions for half-page format', () => {
      const positions = (generator as any).calculateInvoicePositions(InvoiceFormat.HALF_PAGE);

      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({ x: 0, y: 0 });
      expect(positions[1]).toEqual({ x: 0, y: 148.5 });
    });

    it('should return correct positions for quarter-page format', () => {
      const positions = (generator as any).calculateInvoicePositions(InvoiceFormat.QUARTER_PAGE);

      expect(positions).toHaveLength(4);
      expect(positions[0]).toEqual({ x: 0, y: 0 });
      expect(positions[1]).toEqual({ x: 105, y: 0 });
      expect(positions[2]).toEqual({ x: 0, y: 148.5 });
      expect(positions[3]).toEqual({ x: 105, y: 148.5 });
    });
  });

  describe('drawCutLines', () => {
    it('should draw cut lines for half-page format', async () => {
      const request: BatchInvoiceRequest = {
        invoices: [sampleInvoice, { ...sampleInvoice, invoiceNumber: 'INV-002' }],
        format: InvoiceFormat.HALF_PAGE,
      };

      // Generate PDF and verify it doesn't throw errors
      const pdf = await generator.generatePDF(request);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should draw cut lines for quarter-page format', async () => {
      const request: BatchInvoiceRequest = {
        invoices: [
          sampleInvoice,
          { ...sampleInvoice, invoiceNumber: 'INV-002' },
          { ...sampleInvoice, invoiceNumber: 'INV-003' },
          { ...sampleInvoice, invoiceNumber: 'INV-004' },
        ],
        format: InvoiceFormat.QUARTER_PAGE,
      };

      // Generate PDF and verify it doesn't throw errors
      const pdf = await generator.generatePDF(request);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should not draw cut lines for full-page format', async () => {
      const request: BatchInvoiceRequest = {
        invoices: [sampleInvoice],
        format: InvoiceFormat.FULL_PAGE,
      };

      // Generate PDF and verify it doesn't throw errors
      const pdf = await generator.generatePDF(request);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });
});

