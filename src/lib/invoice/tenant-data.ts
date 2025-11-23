// src/lib/invoice/tenant-data.ts

import { prisma } from '@/lib/prisma';
import { InvoiceData } from '@/types/invoice';

/**
 * Tenant business information for invoices
 */
export interface TenantBusinessInfo {
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
}

/**
 * Fetches tenant business information from the database
 * @param tenantId - The ID of the tenant
 * @returns Tenant business information
 */
export async function fetchTenantBusinessInfo(tenantId: string): Promise<TenantBusinessInfo> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      businessName: true,
      businessAddress: true,
      businessPhone: true,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  return {
    businessName: tenant.businessName,
    businessAddress: tenant.businessAddress,
    businessPhone: tenant.businessPhone,
  };
}

/**
 * Maps tenant business information to invoice data structure
 * @param tenantInfo - Tenant business information
 * @param orderData - Order-specific data
 * @returns Complete invoice data
 */
export function mapTenantToInvoiceData(
  tenantInfo: TenantBusinessInfo,
  orderData: {
    invoiceNumber: string;
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
): InvoiceData {
  return {
    invoiceNumber: orderData.invoiceNumber,
    businessName: tenantInfo.businessName,
    businessAddress: tenantInfo.businessAddress,
    businessPhone: tenantInfo.businessPhone,
    customerName: orderData.customerName,
    customerAddress: orderData.customerAddress,
    customerPhone: orderData.customerPhone,
    customerSecondPhone: orderData.customerSecondPhone,
    amount: orderData.amount,
    productName: orderData.productName,
    quantity: orderData.quantity,
    discount: orderData.discount,
    trackingNumber: orderData.trackingNumber,
    shippingProvider: orderData.shippingProvider,
    notes: orderData.notes,
    createdAt: orderData.createdAt,
  };
}

/**
 * Fetches orders and generates invoice data with tenant information
 * @param orderIds - Array of order IDs to fetch
 * @param tenantId - The ID of the tenant
 * @returns Array of invoice data ready for PDF generation
 */
export async function fetchOrdersWithTenantData(
  orderIds: string[],
  tenantId: string
): Promise<InvoiceData[]> {
  // Fetch tenant business information once
  const tenantInfo = await fetchTenantBusinessInfo(tenantId);

  // Fetch all orders with related product data
  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      tenantId: tenantId,
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  // Map orders to invoice data
  return orders.map((order) => {
    return mapTenantToInvoiceData(tenantInfo, {
      invoiceNumber: order.id,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      customerPhone: order.customerPhone,
      customerSecondPhone: order.customerSecondPhone,
      amount: order.total,
      productName: order.product.name,
      quantity: order.quantity,
      discount: order.discount,
      trackingNumber: order.trackingNumber,
      shippingProvider: order.shippingProvider,
      notes: order.notes,
      createdAt: order.createdAt,
    });
  });
}
