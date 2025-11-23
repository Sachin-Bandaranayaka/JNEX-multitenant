// src/app/api/invoices/formats/route.ts

import { NextResponse } from 'next/server';
import { InvoiceFormat } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';

/**
 * Format metadata for API response
 */
interface FormatMetadata {
  format: InvoiceFormat;
  name: string;
  description: string;
  invoicesPerPage: number;
  dimensions: {
    width: number;
    height: number;
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
 * Format names for display
 */
const FORMAT_NAMES: Record<InvoiceFormat, string> = {
  [InvoiceFormat.FULL_PAGE]: 'Full Page',
  [InvoiceFormat.HALF_PAGE]: 'Half Page',
  [InvoiceFormat.QUARTER_PAGE]: 'Quarter Page',
};

/**
 * Format descriptions for display
 */
const FORMAT_DESCRIPTIONS: Record<InvoiceFormat, string> = {
  [InvoiceFormat.FULL_PAGE]: '1 invoice per page with generous spacing and detailed information',
  [InvoiceFormat.HALF_PAGE]: '2 invoices per page with compact layout',
  [InvoiceFormat.QUARTER_PAGE]: '4 invoices per page with minimal spacing for maximum efficiency',
};

/**
 * GET /api/invoices/formats
 * 
 * Returns available invoice format configurations with metadata
 * 
 * @returns Array of format configurations with name, description, and technical details
 */
export async function GET() {
  try {
    // Build format metadata array
    const formats: FormatMetadata[] = Object.values(InvoiceFormat).map((format) => {
      const config = INVOICE_FORMAT_CONFIGS[format];
      
      return {
        format: config.format,
        name: FORMAT_NAMES[format],
        description: FORMAT_DESCRIPTIONS[format],
        invoicesPerPage: config.invoicesPerPage,
        dimensions: config.dimensions,
        margins: config.margins,
        barcodeSize: config.barcodeSize,
        fontSize: config.fontSize,
      };
    });

    return NextResponse.json({
      success: true,
      formats,
    });
  } catch (error) {
    console.error('Error fetching invoice formats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch invoice formats',
        code: 'FORMATS_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}
