// src/lib/invoice/barcode-generator.ts

import JsBarcode from 'jsbarcode';
import { InvoiceFormat } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from './format-configs';
import { invoiceLogger } from './error-logger';

/**
 * Options for barcode generation
 */
export interface BarcodeOptions {
  format?: InvoiceFormat;
  width?: number;  // in mm
  height?: number; // in mm
}

/**
 * Result of barcode generation
 */
export interface BarcodeResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

/**
 * Minimum white space around barcode in mm (as per requirement 9.5)
 */
const BARCODE_WHITE_SPACE_MM = 2;

/**
 * Convert millimeters to pixels (assuming 96 DPI)
 * @param mm - Value in millimeters
 * @returns Value in pixels
 */
function mmToPixels(mm: number): number {
  // 1 inch = 25.4mm, 96 DPI is standard screen resolution
  return Math.round((mm / 25.4) * 96);
}

/**
 * Validates if a barcode value is valid
 * @param value - The value to validate
 * @returns True if valid, false otherwise
 */
function isValidBarcodeValue(value: string): boolean {
  // Barcode value must be non-empty and contain only alphanumeric characters and hyphens
  if (!value || value.trim().length === 0) {
    return false;
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[A-Za-z0-9\-_]+$/;
  return validPattern.test(value);
}

/**
 * Generates a barcode as a base64-encoded image
 * 
 * This function creates a barcode using JsBarcode and returns it as a data URL.
 * It handles different barcode sizes based on the invoice format and ensures
 * minimum white space around the barcode for scanning reliability.
 * 
 * @param value - The value to encode in the barcode (typically invoice number)
 * @param options - Optional configuration for barcode generation
 * @returns Promise resolving to BarcodeResult with success status and data URL or error
 * 
 * @example
 * ```typescript
 * const result = await generateBarcode('INV-12345', { format: InvoiceFormat.FULL_PAGE });
 * if (result.success) {
 *   console.log('Barcode generated:', result.dataUrl);
 * }
 * ```
 */
export async function generateBarcode(
  value: string,
  options: BarcodeOptions = {}
): Promise<BarcodeResult> {
  try {
    // Validate barcode value
    if (!isValidBarcodeValue(value)) {
      invoiceLogger.warn('Invalid barcode value provided', {
        component: 'BarcodeGenerator',
        action: 'generateBarcode',
        value: value,
      });
      return {
        success: false,
        error: 'Invalid barcode value. Must be non-empty and contain only alphanumeric characters, hyphens, or underscores.',
      };
    }

    // Determine barcode dimensions based on format or custom size
    let barcodeWidth: number;
    let barcodeHeight: number;

    if (options.format) {
      const config = INVOICE_FORMAT_CONFIGS[options.format];
      barcodeWidth = config.barcodeSize.width;
      barcodeHeight = config.barcodeSize.height;
    } else if (options.width && options.height) {
      barcodeWidth = options.width;
      barcodeHeight = options.height;
    } else {
      // Default to full-page format size
      const config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE];
      barcodeWidth = config.barcodeSize.width;
      barcodeHeight = config.barcodeSize.height;
    }

    // Add white space around barcode (2mm on each side)
    const totalWidth = barcodeWidth + (BARCODE_WHITE_SPACE_MM * 2);
    const totalHeight = barcodeHeight + (BARCODE_WHITE_SPACE_MM * 2);

    // Convert dimensions to pixels
    const widthPx = mmToPixels(totalWidth);
    const heightPx = mmToPixels(totalHeight);
    const barcodeWidthPx = mmToPixels(barcodeWidth);
    const barcodeHeightPx = mmToPixels(barcodeHeight);

    // Create a canvas element for barcode generation
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        success: false,
        error: 'Failed to get canvas context for barcode generation.',
      };
    }

    // Fill canvas with white background (for white space)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Create a temporary canvas for the barcode itself
    const barcodeCanvas = document.createElement('canvas');
    
    // Generate barcode using JsBarcode
    JsBarcode(barcodeCanvas, value, {
      format: 'CODE128',
      width: 2,
      height: barcodeHeightPx,
      displayValue: false, // Don't show text below barcode
      margin: 0, // We handle margins ourselves
    });

    // Calculate position to center barcode with white space
    const whiteSpacePx = mmToPixels(BARCODE_WHITE_SPACE_MM);
    const xPos = whiteSpacePx;
    const yPos = whiteSpacePx;

    // Draw the barcode onto the main canvas with white space
    ctx.drawImage(barcodeCanvas, xPos, yPos, barcodeWidthPx, barcodeHeightPx);

    // Convert canvas to base64 data URL
    const dataUrl = canvas.toDataURL('image/png');

    return {
      success: true,
      dataUrl,
    };
  } catch (error) {
    // Handle any errors during barcode generation
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    invoiceLogger.error(
      'Barcode generation failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'BarcodeGenerator',
        action: 'generateBarcode',
        value: value,
        format: options.format,
      }
    );
    
    return {
      success: false,
      error: `Barcode generation failed: ${errorMessage}`,
    };
  }
}

/**
 * Generates a barcode synchronously (for server-side use with node-canvas)
 * 
 * Note: This function requires a Canvas implementation to be provided,
 * typically from the 'canvas' package in Node.js environments.
 * 
 * @param value - The value to encode in the barcode
 * @param options - Optional configuration for barcode generation
 * @param Canvas - Canvas constructor (from 'canvas' package)
 * @returns BarcodeResult with success status and data URL or error
 */
export function generateBarcodeSync(
  value: string,
  options: BarcodeOptions = {},
  Canvas?: any
): BarcodeResult {
  try {
    // Validate barcode value
    if (!isValidBarcodeValue(value)) {
      return {
        success: false,
        error: 'Invalid barcode value. Must be non-empty and contain only alphanumeric characters, hyphens, or underscores.',
      };
    }

    // Determine barcode dimensions
    let barcodeWidth: number;
    let barcodeHeight: number;

    if (options.format) {
      const config = INVOICE_FORMAT_CONFIGS[options.format];
      barcodeWidth = config.barcodeSize.width;
      barcodeHeight = config.barcodeSize.height;
    } else if (options.width && options.height) {
      barcodeWidth = options.width;
      barcodeHeight = options.height;
    } else {
      const config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE];
      barcodeWidth = config.barcodeSize.width;
      barcodeHeight = config.barcodeSize.height;
    }

    // Add white space around barcode
    const totalWidth = barcodeWidth + (BARCODE_WHITE_SPACE_MM * 2);
    const totalHeight = barcodeHeight + (BARCODE_WHITE_SPACE_MM * 2);

    // Convert dimensions to pixels
    const widthPx = mmToPixels(totalWidth);
    const heightPx = mmToPixels(totalHeight);
    const barcodeWidthPx = mmToPixels(barcodeWidth);
    const barcodeHeightPx = mmToPixels(barcodeHeight);

    // Create canvas (use provided Canvas constructor or browser's)
    const canvas = Canvas ? new Canvas(widthPx, heightPx) : document.createElement('canvas');
    if (!Canvas) {
      canvas.width = widthPx;
      canvas.height = heightPx;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        success: false,
        error: 'Failed to get canvas context for barcode generation.',
      };
    }

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Create barcode canvas
    const barcodeCanvas = Canvas ? new Canvas(barcodeWidthPx, barcodeHeightPx) : document.createElement('canvas');
    if (!Canvas) {
      barcodeCanvas.width = barcodeWidthPx;
      barcodeCanvas.height = barcodeHeightPx;
    }

    // Generate barcode
    JsBarcode(barcodeCanvas, value, {
      format: 'CODE128',
      width: 2,
      height: barcodeHeightPx,
      displayValue: false,
      margin: 0,
    });

    // Draw barcode with white space
    const whiteSpacePx = mmToPixels(BARCODE_WHITE_SPACE_MM);
    ctx.drawImage(barcodeCanvas, whiteSpacePx, whiteSpacePx, barcodeWidthPx, barcodeHeightPx);

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png');

    return {
      success: true,
      dataUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      error: `Barcode generation failed: ${errorMessage}`,
    };
  }
}

/**
 * Get barcode dimensions for a specific format (including white space)
 * @param format - The invoice format
 * @returns Object with width and height in mm
 */
export function getBarcodeDimensions(format: InvoiceFormat): { width: number; height: number } {
  const config = INVOICE_FORMAT_CONFIGS[format];
  return {
    width: config.barcodeSize.width + (BARCODE_WHITE_SPACE_MM * 2),
    height: config.barcodeSize.height + (BARCODE_WHITE_SPACE_MM * 2),
  };
}
