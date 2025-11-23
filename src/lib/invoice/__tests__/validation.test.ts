// src/lib/invoice/__tests__/validation.test.ts

import { describe, it, expect } from 'vitest';
import {
  validateInvoiceData,
  validateBatchInvoiceRequest,
  isValidPhoneNumber,
  isValidInvoiceNumber,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  formatValidationErrors,
} from '../validation';
import { InvoiceData, InvoiceFormat } from '@/types/invoice';

describe('Validation Utilities', () => {
  describe('isValidPhoneNumber', () => {
    it('should accept valid phone numbers', () => {
      expect(isValidPhoneNumber('+94771234567')).toBe(true);
      expect(isValidPhoneNumber('0771234567')).toBe(true);
      expect(isValidPhoneNumber('077-123-4567')).toBe(true);
      expect(isValidPhoneNumber('077 123 4567')).toBe(true);
      expect(isValidPhoneNumber('+1 (555) 123-4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber('   ')).toBe(false);
      expect(isValidPhoneNumber('abc')).toBe(false);
      expect(isValidPhoneNumber('12')).toBe(false); // Too short
    });
  });

  describe('isValidInvoiceNumber', () => {
    it('should accept valid invoice numbers', () => {
      expect(isValidInvoiceNumber('INV-001')).toBe(true);
      expect(isValidInvoiceNumber('INV_2024_001')).toBe(true);
      expect(isValidInvoiceNumber('12345')).toBe(true);
      expect(isValidInvoiceNumber('ABC-123-XYZ')).toBe(true);
    });

    it('should reject invalid invoice numbers', () => {
      expect(isValidInvoiceNumber('')).toBe(false);
      expect(isValidInvoiceNumber('   ')).toBe(false);
      expect(isValidInvoiceNumber('INV 001')).toBe(false); // Contains space
      expect(isValidInvoiceNumber('INV@001')).toBe(false); // Contains special char
    });
  });

  describe('isNonEmptyString', () => {
    it('should accept non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  hello  ')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should accept positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(1000)).toBe(true);
    });

    it('should reject non-positive numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
    });
  });

  describe('isNonNegativeNumber', () => {
    it('should accept non-negative numbers', () => {
      expect(isNonNegativeNumber(0)).toBe(true);
      expect(isNonNegativeNumber(1)).toBe(true);
      expect(isNonNegativeNumber(0.1)).toBe(true);
    });

    it('should reject negative numbers', () => {
      expect(isNonNegativeNumber(-1)).toBe(false);
      expect(isNonNegativeNumber(-0.1)).toBe(false);
      expect(isNonNegativeNumber(NaN)).toBe(false);
    });
  });

  describe('validateInvoiceData', () => {
    const validInvoice: InvoiceData = {
      invoiceNumber: 'INV-001',
      businessName: 'Test Business',
      businessAddress: '123 Business St',
      businessPhone: '+94771234567',
      customerName: 'John Doe',
      customerAddress: '456 Customer Ave',
      customerPhone: '+94771234568',
      amount: 1000,
      productName: 'Test Product',
      quantity: 2,
      discount: 100,
      createdAt: new Date(),
    };

    it('should validate a valid invoice', () => {
      const result = validateInvoiceData(validInvoice);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invoice with missing invoice number', () => {
      const invalid = { ...validInvoice, invoiceNumber: '' };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'invoiceNumber')).toBe(true);
    });

    it('should reject invoice with invalid invoice number', () => {
      const invalid = { ...validInvoice, invoiceNumber: 'INV 001' };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'invoiceNumber')).toBe(true);
    });

    it('should reject invoice with missing customer name', () => {
      const invalid = { ...validInvoice, customerName: '' };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'customerName')).toBe(true);
    });

    it('should reject invoice with invalid phone number', () => {
      const invalid = { ...validInvoice, customerPhone: 'invalid' };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'customerPhone')).toBe(true);
    });

    it('should reject invoice with negative amount', () => {
      const invalid = { ...validInvoice, amount: -100 };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject invoice with non-integer quantity', () => {
      const invalid = { ...validInvoice, quantity: 1.5 };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'quantity')).toBe(true);
    });

    it('should reject invoice with negative discount', () => {
      const invalid = { ...validInvoice, discount: -50 };
      const result = validateInvoiceData(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'discount')).toBe(true);
    });

    it('should accept invoice with null business fields', () => {
      const invoice = {
        ...validInvoice,
        businessName: null,
        businessAddress: null,
        businessPhone: null,
      };
      const result = validateInvoiceData(invoice);
      expect(result.isValid).toBe(true);
    });

    it('should validate optional second phone if provided', () => {
      const invalidSecondPhone = {
        ...validInvoice,
        customerSecondPhone: 'invalid',
      };
      const result = validateInvoiceData(invalidSecondPhone);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'customerSecondPhone')).toBe(true);
    });
  });

  describe('validateBatchInvoiceRequest', () => {
    const validInvoice: InvoiceData = {
      invoiceNumber: 'INV-001',
      businessName: 'Test Business',
      businessAddress: '123 Business St',
      businessPhone: '+94771234567',
      customerName: 'John Doe',
      customerAddress: '456 Customer Ave',
      customerPhone: '+94771234568',
      amount: 1000,
      productName: 'Test Product',
      quantity: 2,
      discount: 100,
      createdAt: new Date(),
    };

    it('should validate a valid batch request', () => {
      const result = validateBatchInvoiceRequest(
        [validInvoice],
        InvoiceFormat.FULL_PAGE
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty batch', () => {
      const result = validateBatchInvoiceRequest([], InvoiceFormat.FULL_PAGE);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('At least one'))).toBe(true);
    });

    it('should reject batch exceeding 100 invoices', () => {
      const largeBatch = Array(101).fill(validInvoice);
      const result = validateBatchInvoiceRequest(
        largeBatch,
        InvoiceFormat.FULL_PAGE
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Maximum 100'))).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validateBatchInvoiceRequest(
        [validInvoice],
        'INVALID_FORMAT' as any
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'format')).toBe(true);
    });

    it('should validate each invoice in batch', () => {
      const invalidInvoice = { ...validInvoice, customerName: '' };
      const result = validateBatchInvoiceRequest(
        [validInvoice, invalidInvoice],
        InvoiceFormat.FULL_PAGE
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('[1].customerName'))).toBe(true);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format single error', () => {
      const errors = [
        { field: 'customerName', message: 'Customer name is required' },
      ];
      const formatted = formatValidationErrors(errors);
      expect(formatted).toBe('Customer name is required');
    });

    it('should format multiple errors', () => {
      const errors = [
        { field: 'customerName', message: 'Customer name is required' },
        { field: 'amount', message: 'Amount must be positive' },
      ];
      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain('customerName');
      expect(formatted).toContain('amount');
      expect(formatted).toContain('Multiple validation errors');
    });

    it('should handle empty errors array', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('No validation errors');
    });
  });
});
