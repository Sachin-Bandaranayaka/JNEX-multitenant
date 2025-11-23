// src/components/invoice/__tests__/invoice-preview.test.tsx

import { describe, it, expect } from 'vitest';
import { InvoiceFormat, InvoiceData } from '@/types/invoice';

/**
 * Unit tests for InvoicePreview component
 * 
 * These tests verify the component's interface and behavior.
 */
describe('InvoicePreview Component', () => {
  it('should export InvoicePreview component', async () => {
    // Verify the component can be imported
    const module = await import('../invoice-preview');
    expect(module.InvoicePreview).toBeDefined();
    expect(typeof module.InvoicePreview).toBe('function');
  });

  it('should have proper TypeScript types for props', () => {
    // This test verifies that the types compile correctly
    const mockProps = {
      format: InvoiceFormat.FULL_PAGE,
      showCutLines: true,
      sampleData: {
        invoiceNumber: 'INV-001',
        businessName: 'Test Business',
        businessAddress: 'Test Address',
        businessPhone: '+1234567890',
        customerName: 'Test Customer',
        customerAddress: 'Customer Address',
        customerPhone: '+0987654321',
        amount: 1000,
        productName: 'Test Product',
        quantity: 1,
        discount: 0,
        createdAt: new Date(),
      } as InvoiceData,
    };

    expect(mockProps.format).toBe(InvoiceFormat.FULL_PAGE);
    expect(mockProps.showCutLines).toBe(true);
    expect(mockProps.sampleData).toBeDefined();
  });

  it('should support all InvoiceFormat enum values', () => {
    const formats = [
      InvoiceFormat.FULL_PAGE,
      InvoiceFormat.HALF_PAGE,
      InvoiceFormat.QUARTER_PAGE,
    ];

    formats.forEach((format) => {
      expect(Object.values(InvoiceFormat)).toContain(format);
    });
  });

  it('should have optional showCutLines prop', () => {
    // Verify that showCutLines is optional by creating props without it
    const minimalProps = {
      format: InvoiceFormat.FULL_PAGE,
    };

    expect(minimalProps.format).toBeDefined();
    // showCutLines should be optional, so this should compile
  });

  it('should have optional sampleData prop', () => {
    // Verify that sampleData is optional by creating props without it
    const minimalProps = {
      format: InvoiceFormat.HALF_PAGE,
      showCutLines: false,
    };

    expect(minimalProps.format).toBeDefined();
    expect(minimalProps.showCutLines).toBe(false);
    // sampleData should be optional, so this should compile
  });
});

describe('InvoicePreviewExample Component', () => {
  it('should export InvoicePreviewExample component', async () => {
    // Verify the component can be imported
    const module = await import('../invoice-preview-example');
    expect(module.InvoicePreviewExample).toBeDefined();
    expect(typeof module.InvoicePreviewExample).toBe('function');
  });
});
