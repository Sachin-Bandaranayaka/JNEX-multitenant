import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateInvoicePDF } from '@/lib/invoice/pdf-generator';
import { InvoiceFormat, BatchInvoiceRequest, InvoiceData } from '@/types/invoice';
import { validateBatchInvoiceRequest, formatValidationErrors } from '@/lib/invoice/validation';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Zod schema for validating InvoiceData
 * Ensures all required fields are present and properly typed
 */
const InvoiceDataSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  businessName: z.string().nullable(),
  businessAddress: z.string().nullable(),
  businessPhone: z.string().nullable(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerAddress: z.string().min(1, 'Customer address is required'),
  customerPhone: z.string().min(1, 'Customer phone is required'),
  customerSecondPhone: z.string().nullable().optional(),
  amount: z.number().positive('Amount must be positive'),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  discount: z.number().min(0, 'Discount cannot be negative'),
  trackingNumber: z.string().nullable().optional(),
  shippingProvider: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});

/**
 * Zod schema for validating BatchInvoiceRequest
 * Validates format and batch size constraints
 */
const BatchInvoiceRequestSchema = z.object({
  invoices: z.array(InvoiceDataSchema)
    .min(1, 'At least one invoice is required')
    .max(100, 'Maximum 100 invoices per batch'),
  format: z.nativeEnum(InvoiceFormat, {
    errorMap: () => ({ message: 'Invalid format. Must be FULL_PAGE, HALF_PAGE, or QUARTER_PAGE' })
  }),
});

/**
 * POST /api/invoices/generate
 * 
 * Generates a PDF containing one or more invoices in the specified format
 * 
 * Requirements addressed:
 * - 7.5: API endpoint for PDF generation with validation and error handling
 * 
 * Request body:
 * {
 *   invoices: InvoiceData[],
 *   format: InvoiceFormat
 * }
 * 
 * Response:
 * - 200: PDF file (application/pdf)
 * - 400: Validation error
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Parse request body with error handling
    let json: any;
    try {
      json = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
          details: parseError instanceof Error ? parseError.message : 'Failed to parse JSON',
        },
        { status: 400 }
      );
    }

    // Validate using Zod schema
    const validationResult = BatchInvoiceRequestSchema.safeParse(json);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const batchRequest: BatchInvoiceRequest = validationResult.data;

    // Additional validation using custom validation logic
    const customValidation = validateBatchInvoiceRequest(
      batchRequest.invoices,
      batchRequest.format
    );

    if (!customValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: formatValidationErrors(customValidation.errors),
          code: 'VALIDATION_ERROR',
          details: customValidation.errors,
        },
        { status: 400 }
      );
    }

    // Additional validation: Check if batch is empty (redundant but explicit)
    if (batchRequest.invoices.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No invoices selected. Please select at least one invoice to generate.',
          code: 'EMPTY_BATCH',
        },
        { status: 400 }
      );
    }

    // Additional validation: Check if batch size exceeds limit
    if (batchRequest.invoices.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch size exceeds maximum limit of 100 invoices. Please reduce the number of invoices.',
          code: 'BATCH_SIZE_EXCEEDED',
          details: {
            requestedCount: batchRequest.invoices.length,
            maxAllowed: 100,
          },
        },
        { status: 400 }
      );
    }

    // Generate PDF using MultiFormatPDFGenerator
    const pdfBuffer = await generateInvoicePDF(batchRequest);

    // Generate filename based on batch size and format
    const timestamp = Date.now();
    const invoiceCount = batchRequest.invoices.length;
    const formatName = batchRequest.format.toLowerCase().replace('_', '-');
    const filename = `invoices-${formatName}-${invoiceCount}-${timestamp}.pdf`;

    // Return PDF with correct content-type headers
    // Convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    // Log error for debugging
    console.error('Error generating invoice PDF:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Handle Zod validation errors (should be caught above, but just in case)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data. Please check your invoice information.',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle validation errors from our custom validation
    if (error instanceof Error && error.message.includes('validation failed')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Handle PDF generation errors with user-friendly messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const userFriendlyMessage = 
      'Failed to generate invoice PDF. Please try again or contact support if the problem persists.';

    return NextResponse.json(
      {
        success: false,
        error: userFriendlyMessage,
        code: 'PDF_GENERATION_ERROR',
        details: {
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
