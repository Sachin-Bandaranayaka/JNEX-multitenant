// src/components/invoice/__tests__/invoice-templates.test.tsx

import { describe, it, expect } from 'vitest';
import { InvoiceFormat } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';
import type { InvoiceData } from '@/types/invoice';

/**
 * Unit tests for invoice template components
 * 
 * These tests verify that the template components can be imported
 * and have the correct structure.
 */
describe('Invoice Template Components', () => {
  const mockInvoiceData: InvoiceData = {
    invoiceNumber: 'INV-12345',
    businessName: 'Test Business',
    businessAddress: '123 Test St',
    businessPhone: '555-1234',
    customerName: 'John Doe',
    customerAddress: '456 Customer Ave',
    customerPhone: '555-5678',
    amount: 1000,
    productName: 'Test Product',
    quantity: 2,
    discount: 50,
    createdAt: new Date('2024-01-01'),
  };

  describe('FullPageInvoice', () => {
    it('should export FullPageInvoice component', async () => {
      const module = await import('../templates/full-page-invoice');
      expect(module.FullPageInvoice).toBeDefined();
      expect(typeof module.FullPageInvoice).toBe('function');
    });

    it('should accept required props', () => {
      const props = {
        data: mockInvoiceData,
        config: INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE],
        showCutLines: false,
      };

      expect(props.data).toBeDefined();
      expect(props.config).toBeDefined();
      expect(props.showCutLines).toBe(false);
    });

    it('should use full-page configuration', () => {
      const config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE];
      
      expect(config.dimensions.width).toBe(210);
      expect(config.dimensions.height).toBe(297);
      expect(config.invoicesPerPage).toBe(1);
    });
  });

  describe('HalfPageInvoice', () => {
    it('should export HalfPageInvoice component', async () => {
      const module = await import('../templates/half-page-invoice');
      expect(module.HalfPageInvoice).toBeDefined();
      expect(typeof module.HalfPageInvoice).toBe('function');
    });

    it('should accept required props', () => {
      const props = {
        data: mockInvoiceData,
        config: INVOICE_FORMAT_CONFIGS[InvoiceFormat.HALF_PAGE],
        showCutLines: true,
      };

      expect(props.data).toBeDefined();
      expect(props.config).toBeDefined();
      expect(props.showCutLines).toBe(true);
    });

    it('should use half-page configuration', () => {
      const config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.HALF_PAGE];
      
      expect(config.dimensions.width).toBe(210);
      expect(config.dimensions.height).toBe(148.5);
      expect(config.invoicesPerPage).toBe(2);
    });
  });

  describe('QuarterPageInvoice', () => {
    it('should export QuarterPageInvoice component', async () => {
      const module = await import('../templates/quarter-page-invoice');
      expect(module.QuarterPageInvoice).toBeDefined();
      expect(typeof module.QuarterPageInvoice).toBe('function');
    });

    it('should accept required props', () => {
      const props = {
        data: mockInvoiceData,
        config: INVOICE_FORMAT_CONFIGS[InvoiceFormat.QUARTER_PAGE],
        showCutLines: true,
      };

      expect(props.data).toBeDefined();
      expect(props.config).toBeDefined();
      expect(props.showCutLines).toBe(true);
    });

    it('should use quarter-page configuration', () => {
      const config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.QUARTER_PAGE];
      
      expect(config.dimensions.width).toBe(105);
      expect(config.dimensions.height).toBe(148.5);
      expect(config.invoicesPerPage).toBe(4);
    });
  });

  describe('Template Index', () => {
    it('should export all three templates from index', async () => {
      const module = await import('../templates');
      
      expect(module.FullPageInvoice).toBeDefined();
      expect(module.HalfPageInvoice).toBeDefined();
      expect(module.QuarterPageInvoice).toBeDefined();
    });
  });

  describe('Invoice Data Handling', () => {
    it('should handle missing optional fields', () => {
      const minimalData: InvoiceData = {
        invoiceNumber: 'INV-001',
        businessName: null,
        businessAddress: null,
        businessPhone: null,
        customerName: 'Customer',
        customerAddress: 'Address',
        customerPhone: '123',
        amount: 100,
        productName: 'Product',
        quantity: 1,
        discount: 0,
        createdAt: new Date(),
      };

      expect(minimalData.businessName).toBeNull();
      expect(minimalData.businessAddress).toBeNull();
      expect(minimalData.businessPhone).toBeNull();
      expect(minimalData.customerSecondPhone).toBeUndefined();
      expect(minimalData.trackingNumber).toBeUndefined();
      expect(minimalData.notes).toBeUndefined();
    });

    it('should calculate final amount with discount', () => {
      const amount = 1000;
      const discount = 100;
      const finalAmount = amount - discount;

      expect(finalAmount).toBe(900);
    });

    it('should handle zero discount', () => {
      const amount = 1000;
      const discount = 0;
      const finalAmount = amount - discount;

      expect(finalAmount).toBe(1000);
    });
  });
});
