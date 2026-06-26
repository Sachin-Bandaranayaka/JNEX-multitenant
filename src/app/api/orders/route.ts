import { prisma, getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { LeadStatus, OrderStatus, Prisma } from '@prisma/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const orderSchema = z.object({
    leadId: z.string().uuid(),
    productId: z.string().uuid(),
    userId: z.string().uuid(),
    quantity: z.number().int().positive().default(1),
});

// Function to generate a formatted order ID
async function generateOrderId(tx: Prisma.TransactionClient): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    // Use the transaction client for counting orders
    const todayOrders = await tx.order.count({
        where: {
            createdAt: {
                gte: todayStart,
                lt: todayEnd,
            },
        },
    });

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        const sequence = (todayOrders + attempts + 1).toString().padStart(4, '0');
        const potentialId = `JH${year}${month}${day}${sequence}`;

        // Check if this ID already exists
        const existingOrder = await tx.order.findUnique({
            where: { id: potentialId },
        });

        if (!existingOrder) {
            return potentialId;
        }

        attempts++;
    }

    throw new Error('Failed to generate unique order ID after multiple attempts');
}

export async function POST(request: Request) {
    try {
        // Add request URL logging
        const url = request.url;
        console.log('Request URL:', url);

        // Session check with detailed logging
        let session;
        try {
            session = await getServerSession(authOptions);
            console.log('Session check result:', {
                hasSession: !!session,
                hasUser: !!session?.user,
                userId: session?.user?.id,
                userEmail: session?.user?.email,
                userRole: session?.user?.role
            });
        } catch (sessionError) {
            console.error('Session retrieval error:', {
                error: sessionError instanceof Error ? sessionError.message : 'Unknown error',
                stack: sessionError instanceof Error ? sessionError.stack : undefined
            });
            return NextResponse.json(
                { error: 'Session error', details: sessionError instanceof Error ? sessionError.message : 'Unknown error' },
                { status: 500 }
            );
        }

        if (!session?.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Request body parsing with error handling
        let data;
        try {
            data = await request.json();
            console.log('Parsed request data:', data);
        } catch (parseError) {
            console.error('Request parsing error:', parseError);
            return NextResponse.json(
                { error: 'Invalid request format', details: parseError instanceof Error ? parseError.message : 'Unknown parsing error' },
                { status: 400 }
            );
        }

        // Data validation with detailed logging
        let validatedData;
        try {
            validatedData = orderSchema.parse(data);
            console.log('Validation successful:', validatedData);
        } catch (validationError) {
            console.error('Validation error:', validationError);
            return NextResponse.json(
                { error: 'Validation failed', details: validationError },
                { status: 400 }
            );
        }

        // Database operations with detailed error handling
        try {
            // Tenant-scoped lead lookup: a user of Tenant A cannot reference a
            // lead belonging to Tenant B (which would corrupt order/lead links
            // and let them drive stock changes against another tenant).
            const lead = await prisma.lead.findFirst({
                where: { id: validatedData.leadId, tenantId: session.user.tenantId },
                include: { product: true }
            });
            console.log('Lead lookup result:', {
                found: !!lead,
                leadId: validatedData.leadId,
                leadStatus: lead?.status
            });

            if (!lead) {
                return NextResponse.json(
                    { error: 'Lead not found. Please create a lead first before converting to an order.' },
                    { status: 404 }
                );
            }

            if (lead.status === LeadStatus.CONFIRMED) {
                return NextResponse.json(
                    { error: 'Lead is already converted to an order' },
                    { status: 400 }
                );
            }

            // Extract customer information from lead's csvData
            const csvData = lead.csvData as any;
            if (!csvData.name || !csvData.phone || !csvData.address) {
                return NextResponse.json(
                    { error: 'Missing required customer information in lead data' },
                    { status: 400 }
                );
            }

            // The order is assigned to (and the stock adjustment is attributed
            // to) validatedData.userId. Verify that user belongs to the caller's
            // tenant so an order can't be linked to another tenant's user.
            const assignedUser = await prisma.user.findFirst({
                where: { id: validatedData.userId, tenantId: session.user.tenantId },
                select: { id: true },
            });

            if (!assignedUser) {
                return NextResponse.json(
                    { error: 'Assigned user not found in your organization' },
                    { status: 400 }
                );
            }

            // Transaction with detailed logging
            const result = await prisma.$transaction(async (tx) => {
                // Pass the transaction client to generateOrderId
                const orderId = await generateOrderId(tx);
                console.log('Generated orderId:', orderId);

                const product = await tx.product.findFirst({
                    where: { id: validatedData.productId, tenantId: session.user.tenantId },
                    select: { price: true }
                });
                console.log('Product lookup result:', {
                    found: !!product,
                    productId: validatedData.productId,
                    price: product?.price
                });

                if (!product) {
                    throw new Error('Product not found');
                }

                // Calculate total
                const total = product.price * validatedData.quantity;

                // Create order
                const orderData = {
                    id: orderId,
                    status: OrderStatus.PENDING,
                    quantity: validatedData.quantity,
                    total: total,
                    discount: 0,
                    customerName: csvData.name,
                    customerPhone: csvData.phone,
                    customerSecondPhone: csvData.secondPhone || null,
                    customerAddress: csvData.address,
                    customerCity: csvData.city || '',
                    customerEmail: csvData.email || null,
                    notes: csvData.notes || null,
                    product: {
                        connect: { id: lead.product.id },
                    },
                    lead: {
                        connect: { id: validatedData.leadId },
                    },
                    assignedTo: {
                        connect: { id: validatedData.userId },
                    },
                    tenant: {
                        connect: { id: session.user.tenantId },
                    },
                };

                const order = await tx.order.create({
                    data: orderData,
                    include: {
                        product: true,
                        lead: true,
                        assignedTo: true
                    }
                });

                await tx.lead.update({
                    where: { id: validatedData.leadId },
                    data: { status: LeadStatus.CONFIRMED }
                });

                // Adjust product stock based on order quantity
                const currentProduct = await tx.product.findFirst({
                    where: { id: validatedData.productId, tenantId: session.user.tenantId }
                });

                if (!currentProduct) {
                    throw new Error('Product not found when adjusting stock');
                }

                // Calculate new stock level
                const newStock = Math.max(0, currentProduct.stock - validatedData.quantity);

                // Update product stock
                await tx.product.update({
                    where: { id: validatedData.productId },
                    data: { stock: newStock }
                });

                // Record stock adjustment
                await tx.stockAdjustment.create({
                    data: {
                        quantity: -validatedData.quantity,
                        reason: `Order: ${orderId}`,
                        previousStock: currentProduct.stock,
                        newStock: newStock,
                        tenant: {
                            connect: { id: session.user.tenantId },
                        },
                        product: {
                            connect: { id: validatedData.productId },
                        },
                        adjustedBy: {
                            connect: { id: validatedData.userId },
                        },
                    }
                });

                return order;
            }, {
                timeout: 10000,
                maxWait: 5000, // Add maxWait to prevent long waiting times
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable // Ensure consistency
            });

            return NextResponse.json(result);
        } catch (dbError) {
            console.error('Database operation error:', {
                name: dbError instanceof Error ? dbError.name : 'Unknown',
                message: dbError instanceof Error ? dbError.message : 'Unknown error',
                code: (dbError as any)?.code, // Prisma error code
                stack: dbError instanceof Error ? dbError.stack : undefined
            });
            return NextResponse.json(
                {
                    error: 'Database operation failed',
                    details: dbError instanceof Error ? dbError.message : 'Unknown error',
                    code: (dbError as any)?.code
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Unhandled error in order creation:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            cause: error instanceof Error ? error.cause : undefined
        });

        return NextResponse.json(
            {
                error: 'Unhandled error in order creation',
                details: error instanceof Error ? error.message : 'Unknown error',
                type: error instanceof Error ? error.name : 'Unknown'
            },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Tenant-scoped client adds an implicit tenant filter on top of the
        // per-user filter below.
        const prisma = getScopedPrismaClient(session.user.tenantId);

        // Get the status from URL query params
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') as OrderStatus | null;

        // Build the query based on filters
        const query: any = {
            where: {
                userId: session.user.id,
            },
            select: {
                id: true,
                createdAt: true,
                customerName: true,
                customerPhone: true,
                customerSecondPhone: true,
                customerAddress: true,
                notes: true,
                shippingProvider: true,
                trackingNumber: true,
                invoicePrinted: true,
                quantity: true,
                discount: true,
                status: true,
                product: {
                    select: {
                        name: true,
                        price: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc' as const,
            }
        };

        // Add status filter if provided
        if (status) {
            query.where.status = status;
        }

        const orders = await prisma.order.findMany(query);

        return NextResponse.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}