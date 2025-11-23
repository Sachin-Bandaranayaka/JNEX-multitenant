// src/lib/invoice/format-configs.ts

import { InvoiceFormat, InvoiceFormatConfig } from '@/types/invoice';

/**
 * Configuration constants for all supported invoice formats
 * 
 * Each format is optimized for A4 paper (210mm × 297mm) with different densities:
 * - FULL_PAGE: 1 invoice per page with generous spacing
 * - HALF_PAGE: 2 invoices per page (vertical split)
 * - QUARTER_PAGE: 4 invoices per page (2×2 grid)
 */
export const INVOICE_FORMAT_CONFIGS: Record<InvoiceFormat, InvoiceFormatConfig> = {
  [InvoiceFormat.FULL_PAGE]: {
    format: InvoiceFormat.FULL_PAGE,
    invoicesPerPage: 1,
    dimensions: {
      width: 210,  // A4 width in mm
      height: 297, // A4 height in mm
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
      width: 210,      // A4 width in mm
      height: 148.5,   // A4 height / 2 in mm
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
      width: 105,      // A4 width / 2 in mm
      height: 148.5,   // A4 height / 2 in mm
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

/**
 * Get configuration for a specific invoice format
 * @param format - The invoice format to get configuration for
 * @returns The configuration object for the specified format
 */
export function getFormatConfig(format: InvoiceFormat): InvoiceFormatConfig {
  return INVOICE_FORMAT_CONFIGS[format];
}

/**
 * Get all available invoice formats
 * @returns Array of all invoice format enum values
 */
export function getAllFormats(): InvoiceFormat[] {
  return Object.values(InvoiceFormat);
}

/**
 * Validate if a string is a valid invoice format
 * @param format - String to validate
 * @returns True if the string is a valid InvoiceFormat
 */
export function isValidFormat(format: string): format is InvoiceFormat {
  return Object.values(InvoiceFormat).includes(format as InvoiceFormat);
}
