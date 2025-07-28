// src\lib\orders.ts

import { getScopedPrismaClient, prisma as unscopedPrisma } from './prisma';
import { LeadStatus, OrderStatus, Prisma, ShippingProvider } from '@prisma/client';
import { CreateOrderData } from '@/types/orders';

const sendOrderConfirmationEmail = typeof window === 'undefined' ? require('./email').sendOrderConfirmationEmail : null;

export async function createOrderFromLead(data: CreateOrderData) {
  const prisma = getScopedPrismaClient(data.tenantId);

  let orderResult: (Prisma.OrderGetPayload<{}>) | null = null;

  try {
    const [lead, tenant] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: data.leadId },
        include: { product: true },
      }),
      // --- FIX: Fetch the invoicePrefix along with other tenant settings ---
      unscopedPrisma.tenant.findUnique({
        where: { id: data.tenantId },
        select: { 
            defaultShippingProvider: true,
            invoicePrefix: true, // <-- ADDED THIS LINE
        },
      })
    ]);

    if (!lead) throw new Error('Lead not found');
    if (!tenant) throw new Error('Tenant settings not found.');
    if (lead.status === LeadStatus.CONFIRMED) throw new Error('Lead already converted to order');
    
    const csvData = lead.csvData as any;
    if (!csvData.name || !csvData.phone || !csvData.address) {
      throw new Error('Missing required customer information in lead data');
    }

    orderResult = await unscopedPrisma.$transaction(async (tx) => {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      const time = date.getTime().toString().slice(-5);
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      
      // --- FIX: Use the tenant's invoicePrefix for the Order ID ---
      // If no prefix is set, it defaults to 'OD' to ensure an ID is always generated.
      const prefix = tenant.invoicePrefix || 'OD'; 
      const orderId = `${prefix}${year}${month}${day}${time}${random}`;
      // --- End of FIX ---

      const discount = (lead.csvData as any).discount || 0;
      const total = (lead.product.price * data.quantity) - discount;

      const order = await tx.order.create({
        data: {
          id: orderId, // Use the new, dynamic ID
          tenant: { connect: { id: data.tenantId } },
          lead: { connect: { id: data.leadId } },
          product: { connect: { id: lead.product.id } },
          assignedTo: { connect: { id: data.userId } },
          status: OrderStatus.PENDING,
          quantity: data.quantity,
          total: total,
          discount: discount,
          customerName: csvData.name,
          customerPhone: csvData.phone,
          customerSecondPhone: csvData.secondPhone || null,
          customerAddress: csvData.address,
          customerEmail: csvData.email,
          notes: csvData.notes,
          shippingProvider: tenant.defaultShippingProvider || ShippingProvider.FARDA_EXPRESS,
        },
      });

      await tx.lead.update({ 
        where: { id: data.leadId }, 
        data: { status: LeadStatus.CONFIRMED } 
      });
      
      const currentProduct = await tx.product.findUnique({ where: { id: lead.product.id } });
      if (!currentProduct) throw new Error('Product not found when adjusting stock');
      
      const newStock = Math.max(0, currentProduct.stock - data.quantity);
      await tx.product.update({ where: { id: lead.product.id }, data: { stock: newStock } });
      
      await tx.stockAdjustment.create({
        data: {
          tenant: { connect: { id: data.tenantId } },
          product: { connect: { id: lead.product.id } },
          adjustedBy: { connect: { id: data.userId } },
          quantity: -data.quantity,
          reason: `Order: ${orderId}`,
          previousStock: currentProduct.stock,
          newStock: newStock,
        },
      });
      return order;
    }, { timeout: 30000 });

  } catch (error) {
    console.error('Critical error creating order:', error);
    throw error;
  }

  if (orderResult && sendOrderConfirmationEmail) {
    try {
      // sendOrderConfirmationEmail(orderResult.id); 
    } catch (emailError) {
      console.error('Non-critical error sending order confirmation email:', emailError);
    }
  }

  return orderResult;
}

// Enhanced order status update with business logic
export async function updateOrderStatus(orderId: string, status: OrderStatus, tenantId: string, userId?: string) {
  const prisma = getScopedPrismaClient(tenantId);
  
  return await prisma.$transaction(async (tx) => {
    // Get current order with product details
    const currentOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { product: true }
    });
    
    if (!currentOrder) {
      throw new Error('Order not found');
    }
    
        // Validate status transitions with comprehensive business rules
    const validTransitions = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED'], // Cannot cancel shipped orders
      'DELIVERED': ['RETURNED'],
      'CANCELLED': [], // Cannot transition from cancelled
      'RETURNED': []   // Cannot transition from returned
    };
    
    const allowedStatuses = validTransitions[currentOrder.status as keyof typeof validTransitions] as OrderStatus[];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid status transition from ${currentOrder.status} to ${status}`);
    }
    
    // Business rule: Prevent cancellation of shipped, delivered, or returned orders
    if (status === OrderStatus.CANCELLED && 
        ['SHIPPED', 'DELIVERED', 'RETURNED'].includes(currentOrder.status)) {
      throw new Error(`Cannot cancel order that has been ${currentOrder.status.toLowerCase()}. Please process a return instead.`);
    }
    
    // Business rule: Only allow returns for delivered orders
    if (status === OrderStatus.RETURNED && currentOrder.status !== 'DELIVERED') {
      throw new Error(`Can only return orders that have been delivered. Current status: ${currentOrder.status}`);
    }
    
    // Handle inventory restoration for cancellations
    if (status === OrderStatus.CANCELLED && currentOrder.status !== OrderStatus.CANCELLED) {
      // Restore inventory for cancelled orders
      await tx.product.update({
        where: { id: currentOrder.product.id },
        data: {
          stock: {
            increment: currentOrder.quantity
          }
        }
      });
      
      // Create stock adjustment record
      if (userId) {
        await tx.stockAdjustment.create({
          data: {
            tenant: { connect: { id: tenantId } },
            product: { connect: { id: currentOrder.product.id } },
            adjustedBy: { connect: { id: userId } },
            quantity: currentOrder.quantity,
            reason: `Order cancellation: ${orderId}`,
            previousStock: currentOrder.product.stock,
            newStock: currentOrder.product.stock + currentOrder.quantity,
          }
        });
      }
    }
    
    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { 
        status,
        updatedAt: new Date()
      },
      include: { product: true }
    });
    
    return updatedOrder;
  });
}

export async function getConfirmedOrders(tenantId: string) {
  const prisma = getScopedPrismaClient(tenantId);
  return await prisma.order.findMany({
    where: { status: 'CONFIRMED' },
  });
}

export async function getOrder(orderId: string, tenantId: string) {
  const prisma = getScopedPrismaClient(tenantId);
  return await prisma.order.findUnique({
    where: { id: orderId },
  });
}
