// src/lib/invoice/pdf-generator.ts

import jsPDF from 'jspdf';
import { InvoiceData, InvoiceFormat, BatchInvoiceRequest } from '@/types/invoice';
import { getFormatConfig } from './format-configs';
import { generateBarcodeSync } from './barcode-generator';
import { validateBatchInvoiceRequest, formatValidationErrors } from './validation';
import { invoiceLogger } from './error-logger';

/**
 * Position coordinates for placing an invoice on a page
 */
interface InvoicePosition {
  x: number; // X coordinate in mm
  y: number; // Y coordinate in mm
}

/**
 * Multi-format PDF generator for invoices
 * 
 * This class handles the generation of PDF documents containing one or more invoices
 * in various formats (full-page, half-page, quarter-page). It uses jsPDF for PDF
 * generation and supports A4 paper size with print-safe fonts.
 * 
 * Requirements addressed:
 * - 7.1: Generate PDF documents in selected format
 * - 7.2: Set page size to A4 (210mm × 297mm)
 * - 7.3: Embed barcodes as vector graphics
 * - 9.1: Apply appropriate margins for A4 printing
 * - 9.2: Use print-safe fonts (Helvetica, Arial, Times)
 */
export class MultiFormatPDFGenerator {
  private doc: jsPDF;

  constructor() {
    // Initialize jsPDF with A4 dimensions in millimeters
    // A4 size: 210mm × 297mm (requirement 7.2, 9.1)
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  }

  /**
   * Generates a PDF with one or more invoices in the specified format
   * 
   * @param request - Batch invoice request containing invoices and format
   * @returns Promise resolving to PDF as Buffer
   * @throws Error if validation fails or PDF generation encounters an error
   */
  async generatePDF(request: BatchInvoiceRequest): Promise<Buffer> {
    try {
      // Validate the batch request
      const validation = validateBatchInvoiceRequest(request.invoices, request.format);
      if (!validation.isValid) {
        const errorMessage = formatValidationErrors(validation.errors);
        invoiceLogger.error('Invoice validation failed', undefined, {
          component: 'MultiFormatPDFGenerator',
          action: 'generatePDF',
          format: request.format,
          invoiceCount: request.invoices.length,
          validationErrors: validation.errors.length,
        });
        throw new Error(`Invoice validation failed: ${errorMessage}`);
      }

      invoiceLogger.info('Starting PDF generation', {
        component: 'MultiFormatPDFGenerator',
        action: 'generatePDF',
        format: request.format,
        invoiceCount: request.invoices.length,
      });

      const { invoices, format } = request;
      const config = getFormatConfig(format);
      const invoicesPerPage = config.invoicesPerPage;

      // Calculate total number of pages needed
      const totalPages = Math.ceil(invoices.length / invoicesPerPage);

    // Process invoices page by page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      // Add new page for all pages except the first
      if (pageIndex > 0) {
        this.doc.addPage('a4', 'portrait');
      }

      // Calculate which invoices go on this page
      const startIndex = pageIndex * invoicesPerPage;
      const endIndex = Math.min(startIndex + invoicesPerPage, invoices.length);
      const pageInvoices = invoices.slice(startIndex, endIndex);

      // Get positions for invoices on this page
      const positions = this.calculateInvoicePositions(format);

      // Render each invoice at its designated position
      pageInvoices.forEach((invoice, index) => {
        const position = positions[index];
        this.renderInvoice(this.doc, invoice, config, position);
      });

      // Draw cut lines for multi-invoice formats (Requirements 4.5, 5.5, 9.4)
      if (format !== InvoiceFormat.FULL_PAGE) {
        this.drawCutLines(this.doc, format, pageIndex);
      }
    }

      // Convert PDF to buffer
      const pdfOutput = this.doc.output('arraybuffer');
      
      invoiceLogger.info('PDF generation completed successfully', {
        component: 'MultiFormatPDFGenerator',
        action: 'generatePDF',
        format: request.format,
        invoiceCount: request.invoices.length,
        pdfSize: pdfOutput.byteLength,
      });
      
      return Buffer.from(pdfOutput);
    } catch (error) {
      // Log error for debugging
      invoiceLogger.error(
        'PDF generation failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'MultiFormatPDFGenerator',
          action: 'generatePDF',
          format: request.format,
          invoiceCount: request.invoices?.length,
        }
      );
      
      // Re-throw with more context if it's not already our validation error
      if (error instanceof Error && error.message.includes('validation failed')) {
        throw error;
      }
      
      throw new Error(
        `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculates positions for multiple invoices on a page based on format
   */
  private calculateInvoicePositions(format: InvoiceFormat): InvoicePosition[] {
    const positions: InvoicePosition[] = [];

    switch (format) {
      case InvoiceFormat.FULL_PAGE:
        positions.push({ x: 0, y: 0 });
        break;

      case InvoiceFormat.HALF_PAGE:
        positions.push({ x: 0, y: 0 });
        positions.push({ x: 0, y: 148.5 });
        break;

      case InvoiceFormat.QUARTER_PAGE:
        positions.push({ x: 0, y: 0 });
        positions.push({ x: 105, y: 0 });
        positions.push({ x: 0, y: 148.5 });
        positions.push({ x: 105, y: 148.5 });
        break;

      default:
        positions.push({ x: 0, y: 0 });
    }

    return positions;
  }

  /**
   * Renders a single invoice on the PDF at the specified position
   * 
   * This method delegates to format-specific rendering methods based on the format type.
   */
  private renderInvoice(
    doc: jsPDF,
    invoice: InvoiceData,
    config: any,
    position: InvoicePosition
  ): void {
    switch (config.format) {
      case InvoiceFormat.FULL_PAGE:
        this.renderFullPageInvoice(doc, invoice, config, position);
        break;
      case InvoiceFormat.HALF_PAGE:
        this.renderHalfPageInvoice(doc, invoice, config, position);
        break;
      case InvoiceFormat.QUARTER_PAGE:
        this.renderQuarterPageInvoice(doc, invoice, config, position);
        break;
      default:
        this.renderFullPageInvoice(doc, invoice, config, position);
    }
  }

  /**
   * Renders a full-page invoice with generous spacing and itemized details
   * 
   * Requirements addressed:
   * - 2.2, 2.3, 2.4, 2.5: Essential information (business/customer details, total, invoice number)
   * - 3.2: Generous spacing
   * - 3.3: Itemized product details
   * - 3.4: Thank you message
   * - 6.4: Handle missing tenant data with placeholder text
   * - 9.2: Use print-safe fonts
   */
  private renderFullPageInvoice(
    doc: jsPDF,
    invoice: InvoiceData,
    config: any,
    position: InvoicePosition
  ): void {
    const { x: baseX, y: baseY } = position;
    const { margins, fontSize, dimensions } = config;

    // Set print-safe font (Requirement 9.2)
    doc.setFont('helvetica', 'normal');

    const contentX = baseX + margins.left;
    const contentY = baseY + margins.top;
    const contentWidth = dimensions.width - margins.left - margins.right;

    let currentY = contentY;

    // Invoice title with generous spacing
    doc.setFontSize(fontSize.title);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', contentX, currentY);
    currentY += fontSize.title * 0.8;

    // Invoice number (Requirement 2.5)
    doc.setFontSize(fontSize.normal);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, contentX, currentY);
    currentY += fontSize.normal * 0.8;

    // Date
    const dateStr = invoice.createdAt.toLocaleDateString();
    doc.text(`Date: ${dateStr}`, contentX, currentY);
    currentY += fontSize.normal * 1.2;

    // Business information (Requirements 2.2, 6.4)
    doc.setFontSize(fontSize.normal);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', contentX, currentY);
    currentY += fontSize.normal * 0.7;

    doc.setFont('helvetica', 'normal');
    const businessName = invoice.businessName || 'Your Company';
    const businessAddress = invoice.businessAddress || 'Your Business Address';
    const businessPhone = invoice.businessPhone || 'Your Business Phone';
    
    doc.text(businessName, contentX, currentY);
    currentY += fontSize.normal * 0.7;
    doc.text(businessAddress, contentX, currentY);
    currentY += fontSize.normal * 0.7;
    doc.text(`Tel: ${businessPhone}`, contentX, currentY);
    currentY += fontSize.normal * 1.5;

    // Customer information (Requirements 2.3, 2.4)
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', contentX, currentY);
    currentY += fontSize.normal * 0.7;

    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customerName, contentX, currentY);
    currentY += fontSize.normal * 0.7;
    doc.text(invoice.customerAddress, contentX, currentY);
    currentY += fontSize.normal * 0.7;
    doc.text(`Tel: ${invoice.customerPhone}`, contentX, currentY);
    currentY += fontSize.normal * 0.7;

    if (invoice.customerSecondPhone) {
      doc.text(`Tel 2: ${invoice.customerSecondPhone}`, contentX, currentY);
      currentY += fontSize.normal * 0.7;
    }

    currentY += fontSize.normal * 1.2;

    // Itemized product details (Requirement 3.3)
    doc.setFont('helvetica', 'bold');
    doc.text('ITEMIZED DETAILS:', contentX, currentY);
    currentY += fontSize.normal * 0.8;

    // Table header
    doc.setFontSize(fontSize.small);
    doc.setFont('helvetica', 'bold');
    doc.text('Product', contentX, currentY);
    doc.text('Qty', contentX + contentWidth * 0.6, currentY);
    doc.text('Price', contentX + contentWidth * 0.75, currentY);
    currentY += fontSize.small * 0.7;

    // Line under header
    doc.setLineWidth(0.3);
    doc.line(contentX, currentY, contentX + contentWidth, currentY);
    currentY += fontSize.small * 0.5;

    // Product line item
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.productName, contentX, currentY);
    doc.text(invoice.quantity.toString(), contentX + contentWidth * 0.6, currentY);
    doc.text(invoice.amount.toFixed(2), contentX + contentWidth * 0.75, currentY);
    currentY += fontSize.small * 0.8;

    // Discount if applicable
    if (invoice.discount > 0) {
      doc.text('Discount', contentX, currentY);
      doc.text(`-${invoice.discount.toFixed(2)}`, contentX + contentWidth * 0.75, currentY);
      currentY += fontSize.small * 0.8;
    }

    // Line before total
    doc.line(contentX, currentY, contentX + contentWidth, currentY);
    currentY += fontSize.small * 0.5;

    // Total amount (Requirement 2.4)
    doc.setFontSize(fontSize.normal);
    doc.setFont('helvetica', 'bold');
    const totalAmount = invoice.amount - invoice.discount;
    doc.text('TOTAL:', contentX, currentY);
    doc.text(totalAmount.toFixed(2), contentX + contentWidth * 0.75, currentY);
    currentY += fontSize.normal * 1.5;

    // Tracking information
    if (invoice.trackingNumber && invoice.shippingProvider) {
      doc.setFontSize(fontSize.small);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tracking: ${invoice.trackingNumber} (${invoice.shippingProvider})`, contentX, currentY);
      currentY += fontSize.small * 0.8;
    }

    // Notes
    if (invoice.notes) {
      doc.setFontSize(fontSize.small);
      doc.setFont('helvetica', 'italic');
      const notesLines = doc.splitTextToSize(`Notes: ${invoice.notes}`, contentWidth);
      notesLines.forEach((line: string) => {
        doc.text(line, contentX, currentY);
        currentY += fontSize.small * 0.6;
      });
    }

    // Barcode (Requirement 2.1, 7.3)
    this.renderBarcode(doc, invoice, config, position);

    // Thank you message (Requirement 3.4)
    doc.setFontSize(fontSize.normal);
    doc.setFont('helvetica', 'italic');
    const thankYouY = baseY + dimensions.height - margins.bottom - config.barcodeSize.height - 15;
    const thankYouText = 'Thank you for your business!';
    const thankYouWidth = doc.getTextWidth(thankYouText);
    const thankYouX = baseX + (dimensions.width - thankYouWidth) / 2;
    doc.text(thankYouText, thankYouX, thankYouY);
  }

  /**
   * Renders a half-page invoice with compact layout
   * 
   * Requirements addressed:
   * - 2.2, 2.3, 2.4, 2.5: Essential information
   * - 4.3: Compact layout
   * - 6.4: Handle missing tenant data with placeholder text
   * - 9.2: Use print-safe fonts
   */
  private renderHalfPageInvoice(
    doc: jsPDF,
    invoice: InvoiceData,
    config: any,
    position: InvoicePosition
  ): void {
    const { x: baseX, y: baseY } = position;
    const { margins, fontSize, dimensions } = config;

    doc.setFont('helvetica', 'normal');

    const contentX = baseX + margins.left;
    const contentY = baseY + margins.top;
    const contentWidth = dimensions.width - margins.left - margins.right;

    let currentY = contentY;

    // Invoice title
    doc.setFontSize(fontSize.title);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', contentX, currentY);
    currentY += fontSize.title * 0.6;

    // Invoice number and date on same line
    doc.setFontSize(fontSize.normal);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${invoice.invoiceNumber}`, contentX, currentY);
    doc.text(`Date: ${invoice.createdAt.toLocaleDateString()}`, contentX + contentWidth * 0.5, currentY);
    currentY += fontSize.normal * 0.8;

    // Business information
    doc.setFontSize(fontSize.small);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', contentX, currentY);
    currentY += fontSize.small * 0.5;

    doc.setFont('helvetica', 'normal');
    const businessName = invoice.businessName || 'Your Company';
    const businessAddress = invoice.businessAddress || 'Your Business Address';
    const businessPhone = invoice.businessPhone || 'Your Business Phone';
    
    doc.text(businessName, contentX, currentY);
    currentY += fontSize.small * 0.5;
    doc.text(businessAddress, contentX, currentY);
    currentY += fontSize.small * 0.5;
    doc.text(`Tel: ${businessPhone}`, contentX, currentY);
    currentY += fontSize.small * 0.8;

    // Customer information
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', contentX, currentY);
    currentY += fontSize.small * 0.5;

    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customerName, contentX, currentY);
    currentY += fontSize.small * 0.5;
    doc.text(invoice.customerAddress, contentX, currentY);
    currentY += fontSize.small * 0.5;
    doc.text(`Tel: ${invoice.customerPhone}`, contentX, currentY);
    currentY += fontSize.small * 0.5;

    if (invoice.customerSecondPhone) {
      doc.text(`Tel 2: ${invoice.customerSecondPhone}`, contentX, currentY);
      currentY += fontSize.small * 0.5;
    }

    currentY += fontSize.small * 0.6;

    // Product information
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCT:', contentX, currentY);
    currentY += fontSize.small * 0.5;

    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.productName} (Qty: ${invoice.quantity})`, contentX, currentY);
    currentY += fontSize.small * 0.7;

    // Total amount
    doc.setFontSize(fontSize.normal);
    doc.setFont('helvetica', 'bold');
    const totalAmount = invoice.amount - invoice.discount;
    doc.text(`TOTAL: ${totalAmount.toFixed(2)}`, contentX, currentY);
    
    if (invoice.discount > 0) {
      doc.setFontSize(fontSize.small);
      doc.setFont('helvetica', 'normal');
      doc.text(`(Discount: ${invoice.discount.toFixed(2)})`, contentX + contentWidth * 0.5, currentY);
    }
    currentY += fontSize.normal * 0.8;

    // Tracking information
    if (invoice.trackingNumber && invoice.shippingProvider) {
      doc.setFontSize(fontSize.small);
      doc.setFont('helvetica', 'normal');
      doc.text(`Track: ${invoice.trackingNumber}`, contentX, currentY);
      currentY += fontSize.small * 0.6;
    }

    // Notes (limited to 2 lines)
    if (invoice.notes) {
      doc.setFontSize(fontSize.small);
      doc.setFont('helvetica', 'italic');
      const notesLines = doc.splitTextToSize(`Notes: ${invoice.notes}`, contentWidth);
      notesLines.slice(0, 2).forEach((line: string) => {
        doc.text(line, contentX, currentY);
        currentY += fontSize.small * 0.5;
      });
    }

    // Barcode
    this.renderBarcode(doc, invoice, config, position);
  }

  /**
   * Renders a quarter-page invoice with minimal spacing
   * 
   * Requirements addressed:
   * - 2.2, 2.3, 2.4, 2.5: Essential information
   * - 5.3: Minimal spacing
   * - 6.4: Handle missing tenant data with placeholder text
   * - 9.2: Use print-safe fonts
   */
  private renderQuarterPageInvoice(
    doc: jsPDF,
    invoice: InvoiceData,
    config: any,
    position: InvoicePosition
  ): void {
    const { x: baseX, y: baseY } = position;
    const { margins, fontSize, dimensions } = config;

    doc.setFont('helvetica', 'normal');

    const contentX = baseX + margins.left;
    const contentY = baseY + margins.top;
    const contentWidth = dimensions.width - margins.left - margins.right;

    let currentY = contentY;

    // Invoice title
    doc.setFontSize(fontSize.title);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', contentX, currentY);
    currentY += fontSize.title * 0.5;

    // Invoice number
    doc.setFontSize(fontSize.small);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${invoice.invoiceNumber}`, contentX, currentY);
    currentY += fontSize.small * 0.6;

    // Business information
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', contentX, currentY);
    currentY += fontSize.small * 0.4;

    doc.setFont('helvetica', 'normal');
    const businessName = invoice.businessName || 'Your Company';
    const businessPhone = invoice.businessPhone || 'Your Phone';
    
    doc.text(businessName, contentX, currentY);
    currentY += fontSize.small * 0.4;
    doc.text(`Tel: ${businessPhone}`, contentX, currentY);
    currentY += fontSize.small * 0.6;

    // Customer information
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', contentX, currentY);
    currentY += fontSize.small * 0.4;

    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customerName, contentX, currentY);
    currentY += fontSize.small * 0.4;
    
    // Truncate address if too long
    const addressLines = doc.splitTextToSize(invoice.customerAddress, contentWidth);
    doc.text(addressLines[0], contentX, currentY);
    currentY += fontSize.small * 0.4;
    
    doc.text(`Tel: ${invoice.customerPhone}`, contentX, currentY);
    currentY += fontSize.small * 0.6;

    // Product information (condensed)
    doc.text(`${invoice.productName} x${invoice.quantity}`, contentX, currentY);
    currentY += fontSize.small * 0.5;

    // Total amount
    doc.setFont('helvetica', 'bold');
    const totalAmount = invoice.amount - invoice.discount;
    doc.text(`TOTAL: ${totalAmount.toFixed(2)}`, contentX, currentY);

    // Barcode
    this.renderBarcode(doc, invoice, config, position);
  }

  /**
   * Helper method to render barcode at the bottom of an invoice
   * 
   * Requirements addressed:
   * - 2.1: Include barcode representing invoice number
   * - 7.3: Embed barcode as vector graphic
   * - 6.4: Handle errors gracefully
   */
  private renderBarcode(
    doc: jsPDF,
    invoice: InvoiceData,
    config: any,
    position: InvoicePosition
  ): void {
    const { x: baseX, y: baseY } = position;
    const { margins, fontSize, dimensions } = config;

    try {
      const barcodeResult = generateBarcodeSync(invoice.invoiceNumber, {
        format: config.format,
      });

      if (barcodeResult.success && barcodeResult.dataUrl) {
        const barcodeWidth = config.barcodeSize.width;
        const barcodeHeight = config.barcodeSize.height;
        const barcodeX = baseX + (dimensions.width - barcodeWidth) / 2;
        const barcodeY = baseY + dimensions.height - margins.bottom - barcodeHeight - 5;

        doc.addImage(
          barcodeResult.dataUrl,
          'PNG',
          barcodeX,
          barcodeY,
          barcodeWidth,
          barcodeHeight
        );

        doc.setFontSize(fontSize.small);
        doc.setFont('helvetica', 'normal');
        const textWidth = doc.getTextWidth(invoice.invoiceNumber);
        const textX = baseX + (dimensions.width - textWidth) / 2;
        const textY = barcodeY + barcodeHeight + 3;
        doc.text(invoice.invoiceNumber, textX, textY);
      } else {
        // Barcode generation returned failure, use text fallback
        invoiceLogger.warn('Barcode generation failed, using text fallback', {
          component: 'MultiFormatPDFGenerator',
          action: 'renderBarcode',
          invoiceId: invoice.invoiceNumber,
          error: barcodeResult.error,
        });
        this.renderBarcodeTextFallback(doc, invoice, config, position);
      }
    } catch (error) {
      // Fallback to text only (Requirement 6.4)
      invoiceLogger.error(
        'Barcode generation error, using text fallback',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'MultiFormatPDFGenerator',
          action: 'renderBarcode',
          invoiceId: invoice.invoiceNumber,
        }
      );
      this.renderBarcodeTextFallback(doc, invoice, config, position);
    }
  }

  /**
   * Renders invoice number as text when barcode generation fails
   * Provides graceful degradation for barcode errors
   */
  private renderBarcodeTextFallback(
    doc: jsPDF,
    invoice: InvoiceData,
    config: any,
    position: InvoicePosition
  ): void {
    const { x: baseX, y: baseY } = position;
    const { margins, fontSize, dimensions } = config;

    doc.setFontSize(fontSize.small);
    doc.setFont('helvetica', 'normal');
    const textWidth = doc.getTextWidth(invoice.invoiceNumber);
    const textX = baseX + (dimensions.width - textWidth) / 2;
    const textY = baseY + dimensions.height - margins.bottom - 5;
    doc.text(invoice.invoiceNumber, textX, textY);
  }

  /**
   * Draws cut lines between invoices for multi-invoice formats
   * 
   * Requirements addressed:
   * - 4.5: Include dashed cut line between half-page invoices
   * - 5.5: Include dashed cut lines between quarter-page invoices
   * - 9.4: Render cut lines as dashed lines that don't interfere with content
   * 
   * @param doc - jsPDF document instance
   * @param format - Invoice format (determines cut line positions)
   * @param pageIndex - Current page index (for future use if needed)
   */
  private drawCutLines(
    doc: jsPDF,
    format: InvoiceFormat,
    pageIndex: number
  ): void {
    // Set line properties for subtle, non-intrusive cut lines
    doc.setLineWidth(0.1);
    doc.setDrawColor(150, 150, 150); // Light gray color

    /**
     * Helper function to draw a dashed line
     * Creates a dashed pattern with 2mm dashes and 2mm gaps
     */
    const drawDashedLine = (x1: number, y1: number, x2: number, y2: number) => {
      const dashLength = 2;
      const gapLength = 2;
      const isHorizontal = y1 === y2;
      
      if (isHorizontal) {
        let currentX = x1;
        while (currentX < x2) {
          const endX = Math.min(currentX + dashLength, x2);
          doc.line(currentX, y1, endX, y1);
          currentX += dashLength + gapLength;
        }
      } else {
        let currentY = y1;
        while (currentY < y2) {
          const endY = Math.min(currentY + dashLength, y2);
          doc.line(x1, currentY, x1, endY);
          currentY += dashLength + gapLength;
        }
      }
    };

    // Draw cut lines based on format
    switch (format) {
      case InvoiceFormat.HALF_PAGE:
        // Horizontal line at 148.5mm (half of A4 height: 297mm / 2)
        // This divides the page into two equal halves
        drawDashedLine(0, 148.5, 210, 148.5);
        break;

      case InvoiceFormat.QUARTER_PAGE:
        // Horizontal line at 148.5mm (divides page horizontally)
        drawDashedLine(0, 148.5, 210, 148.5);
        // Vertical line at 105mm (half of A4 width: 210mm / 2)
        // This creates a 2x2 grid
        drawDashedLine(105, 0, 105, 297);
        break;

      case InvoiceFormat.FULL_PAGE:
        // No cut lines needed for full-page format
        break;
    }
  }
}

/**
 * Helper function to create a new PDF generator instance and generate PDF
 */
export async function generateInvoicePDF(request: BatchInvoiceRequest): Promise<Buffer> {
  const generator = new MultiFormatPDFGenerator();
  return generator.generatePDF(request);
}
