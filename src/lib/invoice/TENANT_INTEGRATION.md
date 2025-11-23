# Tenant Data Integration

This module provides utilities for fetching tenant business information and mapping it to invoice data structures.

## Overview

The tenant data integration ensures that invoices automatically include the correct business information (name, address, phone) from the tenant's database record. This ensures that:

1. Tenant business information is fetched from the database
2. Updates to tenant data automatically reflect in new invoices
3. Missing tenant data is handled gracefully with null values

## Usage

### Fetching Tenant Business Information

```typescript
import { fetchTenantBusinessInfo } from '@/lib/invoice/tenant-data';

// Fetch tenant business info
const tenantInfo = await fetchTenantBusinessInfo('tenant-id-123');

console.log(tenantInfo);
// {
//   businessName: 'Acme Corporation',
//   businessAddress: '123 Business St, City',
//   businessPhone: '+1-555-0100'
// }
```

### Mapping Tenant Data to Invoice Data

```typescript
import { mapTenantToInvoiceData, TenantBusinessInfo } from '@/lib/invoice/tenant-data';

const tenantInfo: TenantBusinessInfo = {
  businessName: 'My Business',
  businessAddress: '456 Main St',
  businessPhone: '555-1234',
};

const orderData = {
  invoiceNumber: 'INV-001',
  customerName: 'John Doe',
  customerAddress: '789 Customer Ave',
  customerPhone: '555-5678',
  amount: 100.00,
  productName: 'Widget',
  quantity: 2,
  discount: 10.00,
  createdAt: new Date(),
};

const invoiceData = mapTenantToInvoiceData(tenantInfo, orderData);
// Returns complete InvoiceData with both tenant and order information
```

### Fetching Orders with Tenant Data

```typescript
import { fetchOrdersWithTenantData } from '@/lib/invoice/tenant-data';

// Fetch multiple orders and automatically include tenant data
const invoiceDataArray = await fetchOrdersWithTenantData(
  ['order-id-1', 'order-id-2', 'order-id-3'],
  'tenant-id-123'
);

// invoiceDataArray is ready to be passed to PDF generator
```

## Handling Missing Tenant Data

When tenant business information is null or missing, the functions preserve the null values. The PDF generator will handle these by displaying placeholder text (e.g., "Your Company", "Your Address").

```typescript
const tenantInfo = {
  businessName: null,
  businessAddress: null,
  businessPhone: null,
};

const invoiceData = mapTenantToInvoiceData(tenantInfo, orderData);
// invoiceData.businessName === null
// invoiceData.businessAddress === null
// invoiceData.businessPhone === null
```

## Integration with PDF Generator

The tenant data integration is designed to work seamlessly with the multi-format PDF generator:

```typescript
import { fetchOrdersWithTenantData } from '@/lib/invoice/tenant-data';
import { MultiFormatPDFGenerator } from '@/lib/invoice/pdf-generator';
import { InvoiceFormat } from '@/types/invoice';

// Fetch orders with tenant data
const invoices = await fetchOrdersWithTenantData(orderIds, tenantId);

// Generate PDF
const generator = new MultiFormatPDFGenerator();
const pdf = await generator.generatePDF({
  invoices,
  format: InvoiceFormat.FULL_PAGE,
});
```

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 6.1**: Fetches business name from Tenant configuration
- **Requirement 6.2**: Fetches business address from Tenant configuration
- **Requirement 6.3**: Fetches business phone from Tenant configuration
- **Requirement 6.5**: Updates to tenant information reflect in newly generated invoices (by fetching fresh data each time)

The handling of missing tenant data (Requirement 6.4) is implemented at the PDF generation layer, where null values are replaced with placeholder text.
