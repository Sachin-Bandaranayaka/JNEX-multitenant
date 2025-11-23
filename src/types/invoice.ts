// src/types/invoice.ts

/**
 * Enum representing the available invoice format options
 */
export enum InvoiceFormat {
  FULL_PAGE = 'FULL_PAGE',
  HALF_PAGE = 'HALF_PAGE',
  QUARTER_PAGE = 'QUARTER_PAGE',
}

/**
 * Configuration for a specific invoice format
 */
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

/**
 * Data required to generate an invoice
 */
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

/**
 * Request to generate a batch of invoices
 */
export interface BatchInvoiceRequest {
  invoices: InvoiceData[];
  format: InvoiceFormat;
}

/**
 * User preferences for invoice generation
 */
export interface InvoicePreferences {
  defaultFormat: InvoiceFormat;
  lastUsedFormat: InvoiceFormat;
  showCutLines: boolean;
}

/**
 * Request to generate invoices from order IDs
 */
export interface GenerateInvoiceRequest {
  orderIds: string[];
  format: InvoiceFormat;
  tenantId: string;
}

/**
 * Response from invoice generation
 */
export interface GenerateInvoiceResponse {
  success: boolean;
  pdfUrl?: string;
  error?: string;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, any>;
}
