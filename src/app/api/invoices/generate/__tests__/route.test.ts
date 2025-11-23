import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { InvoiceFormat } from '@/types/invoice';
import * as auth from 'next-auth';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock the PDF generator
vi.mock('@/lib/invoice/pdf-generator', () => ({
  generateInvoicePDF: vi.fn(),
}));

// Mock auth options
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('POST /api/invoices/generate', () => {
  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
  };

  const validInvoiceData = {
    invoiceNumber: 'INV-001',
    businessName: 'Test Business',
    businessAddress: '123 Business St',
    businessPhone: '0771234567',
    customerName: 'John Doe',
    customerAddress: '456 Customer Ave',
    customerPhone: '0779876543',
    customerSecondPhone: null,
    amount: 100.50,
    productName: 'Test Product',
    quantity: 2,
    discount: 10.00,
    trackingNumber: null,
    shippingProvider: null,
    notes: null,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(null);

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [validInvoiceData],
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when invoice data is invalid (missing required fields)', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const invalidData = {
      invoices: [{
        invoiceNumber: '',  // Empty invoice number
        customerName: 'John Doe',
        // Missing other required fields
      }],
      format: InvoiceFormat.FULL_PAGE,
    };

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.details).toBeDefined();
  });

  it('should return 400 when format is invalid', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [validInvoiceData],
        format: 'INVALID_FORMAT',
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when batch is empty', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [],
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when batch size exceeds 100 invoices', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    // Create 101 invoices
    const tooManyInvoices = Array(101).fill(validInvoiceData);

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: tooManyInvoices,
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should return 200 with PDF when request is valid', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const mockPdfBuffer = Buffer.from('mock-pdf-content');
    const { generateInvoicePDF } = await import('@/lib/invoice/pdf-generator');
    vi.mocked(generateInvoicePDF).mockResolvedValue(mockPdfBuffer);

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [validInvoiceData],
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('.pdf');
  });

  it('should return 500 when PDF generation fails', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const { generateInvoicePDF } = await import('@/lib/invoice/pdf-generator');
    vi.mocked(generateInvoicePDF).mockRejectedValue(new Error('PDF generation failed'));

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [validInvoiceData],
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.code).toBe('PDF_GENERATION_ERROR');
  });

  it('should handle multiple invoices in a batch', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const mockPdfBuffer = Buffer.from('mock-pdf-content');
    const { generateInvoicePDF } = await import('@/lib/invoice/pdf-generator');
    vi.mocked(generateInvoicePDF).mockResolvedValue(mockPdfBuffer);

    const multipleInvoices = [
      { ...validInvoiceData, invoiceNumber: 'INV-001' },
      { ...validInvoiceData, invoiceNumber: 'INV-002' },
      { ...validInvoiceData, invoiceNumber: 'INV-003' },
    ];

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: multipleInvoices,
        format: InvoiceFormat.HALF_PAGE,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(generateInvoicePDF).toHaveBeenCalledWith({
      invoices: multipleInvoices,
      format: InvoiceFormat.HALF_PAGE,
    });
  });

  it('should accept all three format types', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const mockPdfBuffer = Buffer.from('mock-pdf-content');
    const { generateInvoicePDF } = await import('@/lib/invoice/pdf-generator');
    vi.mocked(generateInvoicePDF).mockResolvedValue(mockPdfBuffer);

    const formats = [
      InvoiceFormat.FULL_PAGE,
      InvoiceFormat.HALF_PAGE,
      InvoiceFormat.QUARTER_PAGE,
    ];

    for (const format of formats) {
      const request = new Request('http://localhost/api/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({
          invoices: [validInvoiceData],
          format,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });

  it('should validate positive amount', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const invalidData = {
      ...validInvoiceData,
      amount: -10.00,  // Negative amount
    };

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [invalidData],
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('should validate non-negative discount', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(mockSession as any);

    const invalidData = {
      ...validInvoiceData,
      discount: -5.00,  // Negative discount
    };

    const request = new Request('http://localhost/api/invoices/generate', {
      method: 'POST',
      body: JSON.stringify({
        invoices: [invalidData],
        format: InvoiceFormat.FULL_PAGE,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('VALIDATION_ERROR');
  });
});
