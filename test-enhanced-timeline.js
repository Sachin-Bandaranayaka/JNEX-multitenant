const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupEnhancedTimelineDemo() {
    try {
        console.log('Setting up Enhanced Timeline Demo...');

        // Get the first tenant
        const tenant = await prisma.tenant.findFirst();
        if (!tenant) {
            console.error('No tenant found. Please run the seed script first.');
            return;
        }

        console.log('Found tenant:', tenant.name);

        // Update tenant with Royal Express configuration
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                royalExpressApiKey: 'demo@example.com:demopassword', // Demo credentials
                defaultShippingProvider: 'ROYAL_EXPRESS'
            }
        });

        console.log('Updated tenant with Royal Express configuration');

        // Create a demo product
        const product = await prisma.product.upsert({
            where: { 
                code_tenantId: {
                    code: 'DEMO001',
                    tenantId: tenant.id
                }
            },
            update: {},
            create: {
                code: 'DEMO001',
                name: 'Demo Product',
                price: 2500.00,
                stock: 100,
                tenantId: tenant.id
            }
        });

        // Create a demo lead
        const lead = await prisma.lead.create({
            data: {
                csvData: {
                    name: 'John Doe',
                    phone: '+94771234567',
                    email: 'john.doe@example.com',
                    address: '123 Main Street, Colombo 03',
                    city: 'Colombo'
                },
                productCode: 'DEMO001',
                tenantId: tenant.id
            }
        });

        // Get the first user for assignment
        const user = await prisma.user.findFirst({
            where: { tenantId: tenant.id }
        });

        // Create a demo order with Royal Express tracking
        const order = await prisma.order.create({
            data: {
                id: `order_${Date.now()}`,
                customerName: 'John Doe',
                customerPhone: '+94771234567',
                customerAddress: '123 Main Street, Colombo 03',
                customerCity: 'Colombo',
                customerEmail: 'john.doe@example.com',
                productId: product.id,
                leadId: lead.id,
                userId: user.id,
                quantity: 1,
                total: 2500.00,
                status: 'SHIPPED',
                shippingProvider: 'ROYAL_EXPRESS',
                trackingNumber: 'RE123456789',
                shippedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                tenantId: tenant.id,
                
                // Add enhanced tracking data
                trackingUpdates: {
                    create: [
                        {
                            status: 'Order Placed',
                            statusCode: 'OP',
                            timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
                            description: 'Order has been placed and is being processed',
                            provider: 'ROYAL_EXPRESS',
                            trackingNumber: 'RE123456789',
                            tenantId: tenant.id
                        },
                        {
                            status: 'Order Confirmed',
                            statusCode: 'OC',
                            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                            description: 'Order confirmed and payment verified',
                            provider: 'ROYAL_EXPRESS',
                            trackingNumber: 'RE123456789',
                            tenantId: tenant.id
                        },
                        {
                            status: 'Processing',
                            statusCode: 'PR',
                            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                            description: 'Order is being prepared for shipment',
                            provider: 'ROYAL_EXPRESS',
                            trackingNumber: 'RE123456789',
                            tenantId: tenant.id
                        },
                        {
                            status: 'Picked Up',
                            statusCode: 'PU',
                            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                            description: 'Package picked up from warehouse',
                            location: 'Colombo Distribution Center',
                            provider: 'ROYAL_EXPRESS',
                            trackingNumber: 'RE123456789',
                            tenantId: tenant.id
                        },
                        {
                            status: 'In Transit',
                            statusCode: 'IT',
                            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
                            description: 'Package is in transit to destination',
                            location: 'Kandy Hub',
                            provider: 'ROYAL_EXPRESS',
                            trackingNumber: 'RE123456789',
                            tenantId: tenant.id
                        }
                    ]
                },
                
                financialInfo: {
                    create: {
                        totalAmount: 2500.00,
                        shippingCost: 350.00,
                        taxAmount: 375.00,
                        discountAmount: 0.00,
                        paymentStatus: 'PAID',
                        paymentMethod: 'CARD',
                        currency: 'LKR',
                        tenantId: tenant.id
                    }
                },
                
                royalExpressTracking: {
                    create: {
                        trackingNumber: 'RE123456789',
                        currentStatus: 'In Transit',
                        currentStatusCode: 'IT',
                        estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                        lastLocationUpdate: 'Kandy Hub - Package in transit',
                        totalStatusUpdates: 5,
                        tenantId: tenant.id
                    }
                }
            }
        });

        console.log('Created demo order with enhanced tracking data:', order.id);
        console.log('');
        console.log('🎉 Enhanced Timeline Demo Setup Complete!');
        console.log('');
        console.log('You can now:');
        console.log(`1. Visit: http://localhost:3000/orders/${order.id}`);
        console.log('2. See the enhanced Royal Express timeline with:');
        console.log('   - Detailed status history');
        console.log('   - Financial information');
        console.log('   - Location tracking');
        console.log('   - Enhanced visual timeline');
        console.log('');
        console.log('Order Details:');
        console.log(`- Order ID: ${order.id}`);
        console.log(`- Tracking Number: ${order.trackingNumber}`);
        console.log(`- Status: ${order.status}`);
        console.log(`- Shipping Provider: ${order.shippingProvider}`);

    } catch (error) {
        console.error('Error setting up demo:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupEnhancedTimelineDemo();