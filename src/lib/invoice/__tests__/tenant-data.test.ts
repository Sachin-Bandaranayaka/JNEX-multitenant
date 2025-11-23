// src/lib/invoice/__tests__/tenant-data.test.ts

import { describe, it, expect } from 'vitest';
import { mapTenantToInvoiceData, TenantBusinessInfo } from '../tenant-data';
import { InvoiceData } from '@/types/invoice';

describe('Tenant Data Integration', () => {
  describe('mapTenantToInvoiceData', () => {
    it('should map tenant and order data to invoice data structure', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'Test Business Inc.',
        businessAddress: '123 Business Street, City',
        businessPhone: '+1-555-0100',
      };

      const orderData = {
        invoiceNumber: 'INV-2024-001',
        customerName: 'John Doe',
        customerAddress: '456 Customer Ave, Town',
        customerPhone: '+1-555-0200',
        customerSecondPhone: '+1-555-0201',
        amount: 150.00,
        productName: 'Premium Widget',
        quantity: 3,
        discount: 15.00,
        trackingNumber: 'TRACK-123456',
        shippingProvider: 'Express Courier',
        notes: 'Handle with care',
        createdAt: new Date('2024-01-15'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      expect(result).toEqual({
        invoiceNumber: 'INV-2024-001',
        businessName: 'Test Business Inc.',
        businessAddress: '123 Business Street, City',
        businessPhone: '+1-555-0100',
        customerName: 'John Doe',
        customerAddress: '456 Customer Ave, Town',
        customerPhone: '+1-555-0200',
        customerSecondPhone: '+1-555-0201',
        amount: 150.00,
        productName: 'Premium Widget',
        quantity: 3,
        discount: 15.00,
        trackingNumber: 'TRACK-123456',
        shippingProvider: 'Express Courier',
        notes: 'Handle with care',
        createdAt: new Date('2024-01-15'),
      });
    });

    it('should handle null tenant business information', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: null,
        businessAddress: null,
        businessPhone: null,
      };

      const orderData = {
        invoiceNumber: 'INV-2024-002',
        customerName: 'Jane Smith',
        customerAddress: '789 Client Road',
        customerPhone: '+1-555-0300',
        amount: 200.00,
        productName: 'Standard Widget',
        quantity: 2,
        discount: 0,
        createdAt: new Date('2024-01-16'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      expect(result.businessName).toBeNull();
      expect(result.businessAddress).toBeNull();
      expect(result.businessPhone).toBeNull();
      expect(result.customerName).toBe('Jane Smith');
      expect(result.amount).toBe(200.00);
    });

    it('should handle optional order fields being undefined', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'My Company',
        businessAddress: '100 Main St',
        businessPhone: '555-1000',
      };

      const orderData = {
        invoiceNumber: 'INV-2024-003',
        customerName: 'Bob Johnson',
        customerAddress: '321 Oak Lane',
        customerPhone: '555-2000',
        amount: 75.50,
        productName: 'Basic Widget',
        quantity: 1,
        discount: 5.50,
        createdAt: new Date('2024-01-17'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      expect(result.customerSecondPhone).toBeUndefined();
      expect(result.trackingNumber).toBeUndefined();
      expect(result.shippingProvider).toBeUndefined();
      expect(result.notes).toBeUndefined();
    });

    it('should preserve all tenant information when provided', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'Acme Corporation',
        businessAddress: '999 Corporate Blvd, Suite 500',
        businessPhone: '1-800-ACME-NOW',
      };

      const orderData = {
        invoiceNumber: 'ACME-2024-100',
        customerName: 'Enterprise Client',
        customerAddress: '1000 Enterprise Way',
        customerPhone: '555-9999',
        amount: 5000.00,
        productName: 'Enterprise Solution',
        quantity: 10,
        discount: 500.00,
        createdAt: new Date('2024-01-20'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      // Verify tenant data is correctly mapped
      expect(result.businessName).toBe('Acme Corporation');
      expect(result.businessAddress).toBe('999 Corporate Blvd, Suite 500');
      expect(result.businessPhone).toBe('1-800-ACME-NOW');
    });

    it('should handle mixed null and non-null tenant fields', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'Partial Info Business',
        businessAddress: null,
        businessPhone: '555-5555',
      };

      const orderData = {
        invoiceNumber: 'INV-2024-004',
        customerName: 'Test Customer',
        customerAddress: 'Test Address',
        customerPhone: '555-6666',
        amount: 100.00,
        productName: 'Test Product',
        quantity: 1,
        discount: 0,
        createdAt: new Date('2024-01-18'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      expect(result.businessName).toBe('Partial Info Business');
      expect(result.businessAddress).toBeNull();
      expect(result.businessPhone).toBe('555-5555');
    });

    it('should correctly map all order fields', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'Test Co',
        businessAddress: 'Test Address',
        businessPhone: 'Test Phone',
      };

      const orderData = {
        invoiceNumber: 'TEST-001',
        customerName: 'Customer A',
        customerAddress: 'Address A',
        customerPhone: 'Phone A',
        customerSecondPhone: 'Phone A2',
        amount: 99.99,
        productName: 'Product X',
        quantity: 5,
        discount: 9.99,
        trackingNumber: 'TRACK-999',
        shippingProvider: 'Fast Ship',
        notes: 'Urgent delivery',
        createdAt: new Date('2024-02-01'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      // Verify all order fields are correctly mapped
      expect(result.invoiceNumber).toBe('TEST-001');
      expect(result.customerName).toBe('Customer A');
      expect(result.customerAddress).toBe('Address A');
      expect(result.customerPhone).toBe('Phone A');
      expect(result.customerSecondPhone).toBe('Phone A2');
      expect(result.amount).toBe(99.99);
      expect(result.productName).toBe('Product X');
      expect(result.quantity).toBe(5);
      expect(result.discount).toBe(9.99);
      expect(result.trackingNumber).toBe('TRACK-999');
      expect(result.shippingProvider).toBe('Fast Ship');
      expect(result.notes).toBe('Urgent delivery');
      expect(result.createdAt).toEqual(new Date('2024-02-01'));
    });

    it('should handle zero discount', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'No Discount Store',
        businessAddress: '123 Full Price Ave',
        businessPhone: '555-0000',
      };

      const orderData = {
        invoiceNumber: 'INV-FULL-001',
        customerName: 'Full Price Customer',
        customerAddress: 'Customer St',
        customerPhone: '555-1111',
        amount: 250.00,
        productName: 'Full Price Item',
        quantity: 1,
        discount: 0,
        createdAt: new Date('2024-01-25'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      expect(result.discount).toBe(0);
      expect(result.amount).toBe(250.00);
    });

    it('should handle large quantities and amounts', () => {
      const tenantInfo: TenantBusinessInfo = {
        businessName: 'Bulk Supplier',
        businessAddress: 'Warehouse District',
        businessPhone: '555-BULK',
      };

      const orderData = {
        invoiceNumber: 'BULK-2024-001',
        customerName: 'Wholesale Buyer',
        customerAddress: 'Distribution Center',
        customerPhone: '555-WHOLE',
        amount: 99999.99,
        productName: 'Bulk Item',
        quantity: 1000,
        discount: 9999.99,
        createdAt: new Date('2024-01-30'),
      };

      const result = mapTenantToInvoiceData(tenantInfo, orderData);

      expect(result.quantity).toBe(1000);
      expect(result.amount).toBe(99999.99);
      expect(result.discount).toBe(9999.99);
    });
  });
});
