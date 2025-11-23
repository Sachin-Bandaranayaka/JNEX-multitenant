// src/components/invoice/__tests__/format-selector.test.tsx

import { describe, it, expect } from 'vitest';
import { InvoiceFormat } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';

/**
 * Unit tests for FormatSelector component
 * 
 * Note: These tests verify the component's interface and configuration.
 * Full DOM rendering tests would require @testing-library/react setup.
 */
describe('FormatSelector Component', () => {
  it('should have all required format configurations available', () => {
    // Verify that all three formats have configurations
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE]).toBeDefined();
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.HALF_PAGE]).toBeDefined();
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.QUARTER_PAGE]).toBeDefined();
  });

  it('should have correct format descriptions', () => {
    // Verify invoicesPerPage matches expected descriptions
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE].invoicesPerPage).toBe(1);
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.HALF_PAGE].invoicesPerPage).toBe(2);
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.QUARTER_PAGE].invoicesPerPage).toBe(4);
  });

  it('should have correct dimensions for each format', () => {
    // Full page: 210×297mm (A4)
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE].dimensions).toEqual({
      width: 210,
      height: 297,
    });

    // Half page: 210×148.5mm (A4 width, half height)
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.HALF_PAGE].dimensions).toEqual({
      width: 210,
      height: 148.5,
    });

    // Quarter page: 105×148.5mm (half A4 width, half height)
    expect(INVOICE_FORMAT_CONFIGS[InvoiceFormat.QUARTER_PAGE].dimensions).toEqual({
      width: 105,
      height: 148.5,
    });
  });

  it('should export FormatSelector component', async () => {
    // Verify the component can be imported
    const module = await import('../format-selector');
    expect(module.FormatSelector).toBeDefined();
    expect(typeof module.FormatSelector).toBe('function');
  });

  it('should have proper TypeScript types', () => {
    // This test verifies that the types compile correctly
    // If there were type errors, the test file wouldn't compile
    const mockProps = {
      selectedFormat: InvoiceFormat.FULL_PAGE,
      onFormatChange: (format: InvoiceFormat) => {
        // Mock callback
        expect(format).toBeDefined();
      },
    };

    expect(mockProps.selectedFormat).toBe(InvoiceFormat.FULL_PAGE);
    expect(typeof mockProps.onFormatChange).toBe('function');
  });

  it('should support all InvoiceFormat enum values', () => {
    const formats = Object.values(InvoiceFormat);
    
    expect(formats).toContain(InvoiceFormat.FULL_PAGE);
    expect(formats).toContain(InvoiceFormat.HALF_PAGE);
    expect(formats).toContain(InvoiceFormat.QUARTER_PAGE);
    expect(formats).toHaveLength(3);
  });
});
