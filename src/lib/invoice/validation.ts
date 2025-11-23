// src/lib/invoice/validation.ts

import { InvoiceData, InvoiceFormat } from '@/types/invoice';
import { isValidFormat } from './format-configs';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a phone number format
 * Accepts various formats: +94771234567, 0771234567, 077-123-4567, etc.
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || phone.trim().length === 0) {
    return false;
  }
  
  // Remove common separators
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check if it contains only digits and optional leading +
  const phonePattern = /^\+?\d{9,15}$/;
  return phonePattern.test(cleaned);
}

/**
 * Validates an invoice number format
 * Must be non-empty and contain only alphanumeric characters, hyphens, or underscores
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  if (!invoiceNumber || invoiceNumber.trim().length === 0) {
    return false;
  }
  
  const pattern = /^[A-Za-z0-9\-_]+$/;
  return pattern.test(invoiceNumber);
}

/**
 * Validates that a string is non-empty
 */
export function isNonEmptyString(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates that a number is positive
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

/**
 * Validates that a number is non-negative
 */
export function isNonNegativeNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

/**
 * Validates a single invoice data object
 * 
 * Requirements addressed:
 * - Validation for required invoice fields
 * - Error handling scenarios
 * 
 * @param invoice - The invoice data to validate
 * @returns ValidationResult with isValid flag and array of errors
 */
export function validateInvoiceData(invoice: InvoiceData): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate invoice number
  if (!invoice.invoiceNumber) {
    errors.push({
      field: 'invoiceNumber',
      message: 'Invoice number is required',
      value: invoice.invoiceNumber,
    });
  } else if (!isValidInvoiceNumber(invoice.invoiceNumber)) {
    errors.push({
      field: 'invoiceNumber',
      message: 'Invoice number must contain only alphanumeric characters, hyphens, or underscores',
      value: invoice.invoiceNumber,
    });
  }

  // Validate customer name
  if (!invoice.customerName) {
    errors.push({
      field: 'customerName',
      message: 'Customer name is required',
      value: invoice.customerName,
    });
  } else if (!isNonEmptyString(invoice.customerName)) {
    errors.push({
      field: 'customerName',
      message: 'Customer name cannot be empty',
      value: invoice.customerName,
    });
  }

  // Validate customer address
  if (!invoice.customerAddress) {
    errors.push({
      field: 'customerAddress',
      message: 'Customer address is required',
      value: invoice.customerAddress,
    });
  } else if (!isNonEmptyString(invoice.customerAddress)) {
    errors.push({
      field: 'customerAddress',
      message: 'Customer address cannot be empty',
      value: invoice.customerAddress,
    });
  }

  // Validate customer phone
  if (!invoice.customerPhone) {
    errors.push({
      field: 'customerPhone',
      message: 'Customer phone is required',
      value: invoice.customerPhone,
    });
  } else if (!isValidPhoneNumber(invoice.customerPhone)) {
    errors.push({
      field: 'customerPhone',
      message: 'Customer phone must be a valid phone number',
      value: invoice.customerPhone,
    });
  }

  // Validate customer second phone (optional, but if provided must be valid)
  if (invoice.customerSecondPhone && !isValidPhoneNumber(invoice.customerSecondPhone)) {
    errors.push({
      field: 'customerSecondPhone',
      message: 'Customer second phone must be a valid phone number',
      value: invoice.customerSecondPhone,
    });
  }

  // Validate amount
  if (invoice.amount === undefined || invoice.amount === null) {
    errors.push({
      field: 'amount',
      message: 'Amount is required',
      value: invoice.amount,
    });
  } else if (!isPositiveNumber(invoice.amount)) {
    errors.push({
      field: 'amount',
      message: 'Amount must be a positive number',
      value: invoice.amount,
    });
  }

  // Validate product name
  if (!invoice.productName) {
    errors.push({
      field: 'productName',
      message: 'Product name is required',
      value: invoice.productName,
    });
  } else if (!isNonEmptyString(invoice.productName)) {
    errors.push({
      field: 'productName',
      message: 'Product name cannot be empty',
      value: invoice.productName,
    });
  }

  // Validate quantity
  if (invoice.quantity === undefined || invoice.quantity === null) {
    errors.push({
      field: 'quantity',
      message: 'Quantity is required',
      value: invoice.quantity,
    });
  } else if (!Number.isInteger(invoice.quantity) || invoice.quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: 'Quantity must be a positive integer',
      value: invoice.quantity,
    });
  }

  // Validate discount
  if (invoice.discount === undefined || invoice.discount === null) {
    errors.push({
      field: 'discount',
      message: 'Discount is required',
      value: invoice.discount,
    });
  } else if (!isNonNegativeNumber(invoice.discount)) {
    errors.push({
      field: 'discount',
      message: 'Discount cannot be negative',
      value: invoice.discount,
    });
  }

  // Validate createdAt
  if (!invoice.createdAt) {
    errors.push({
      field: 'createdAt',
      message: 'Created date is required',
      value: invoice.createdAt,
    });
  } else if (!(invoice.createdAt instanceof Date) || isNaN(invoice.createdAt.getTime())) {
    errors.push({
      field: 'createdAt',
      message: 'Created date must be a valid date',
      value: invoice.createdAt,
    });
  }

  // Business fields are optional (nullable), so no validation needed
  // Tracking and shipping fields are optional, so no validation needed
  // Notes field is optional, so no validation needed

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a batch of invoices
 * 
 * @param invoices - Array of invoice data to validate
 * @param format - The invoice format
 * @returns ValidationResult with isValid flag and array of errors
 */
export function validateBatchInvoiceRequest(
  invoices: InvoiceData[],
  format: InvoiceFormat | string
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate format
  if (!format) {
    errors.push({
      field: 'format',
      message: 'Invoice format is required',
      value: format,
    });
  } else if (typeof format === 'string' && !isValidFormat(format)) {
    errors.push({
      field: 'format',
      message: 'Invalid invoice format. Must be FULL_PAGE, HALF_PAGE, or QUARTER_PAGE',
      value: format,
    });
  }

  // Validate invoices array
  if (!invoices) {
    errors.push({
      field: 'invoices',
      message: 'Invoices array is required',
      value: invoices,
    });
    return { isValid: false, errors };
  }

  if (!Array.isArray(invoices)) {
    errors.push({
      field: 'invoices',
      message: 'Invoices must be an array',
      value: invoices,
    });
    return { isValid: false, errors };
  }

  // Validate batch size
  if (invoices.length === 0) {
    errors.push({
      field: 'invoices',
      message: 'At least one invoice is required',
      value: invoices.length,
    });
  }

  if (invoices.length > 100) {
    errors.push({
      field: 'invoices',
      message: 'Maximum 100 invoices per batch',
      value: invoices.length,
    });
  }

  // Validate each invoice
  invoices.forEach((invoice, index) => {
    const invoiceValidation = validateInvoiceData(invoice);
    if (!invoiceValidation.isValid) {
      invoiceValidation.errors.forEach((error) => {
        errors.push({
          field: `invoices[${index}].${error.field}`,
          message: error.message,
          value: error.value,
        });
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Formats validation errors into a user-friendly message
 * 
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No validation errors';
  }

  if (errors.length === 1) {
    return errors[0].message;
  }

  return `Multiple validation errors:\n${errors.map((e) => `- ${e.field}: ${e.message}`).join('\n')}`;
}
