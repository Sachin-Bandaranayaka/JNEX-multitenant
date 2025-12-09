import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Analyzing recent cron job execution...');

    // 1. Count total orders that SHOULD be checked (Shipped but not Delivered)
    const pendingOrdersCount = await prisma.order.count({
        where: {
            status: 'SHIPPED',
            shippingProvider: { not: null },
            trackingNumber: { not: null },
            deliveredAt: null,
        }
    });
    console.log(`Total 'SHIPPED' orders waiting for updates: ${pendingOrdersCount}`);

    // 2. Get updates from the last 3 hours (covering the 2-hour cron window)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const recentUpdates = await prisma.trackingUpdate.findMany({
        where: {
            timestamp: {
                gte: threeHoursAgo
            }
        },
        orderBy: { timestamp: 'desc' },
        include: {
            order: {
                select: { trackingNumber: true, shippingProvider: true }
            }
        }
    });

    console.log(`Total updates received in last 3 hours: ${recentUpdates.length}`);

    // 3. Group by status
    const statusCounts: Record<string, number> = {};
    const distinctOrders = new Set();

    recentUpdates.forEach(update => {
        distinctOrders.add(update.orderId);
        statusCounts[update.status] = (statusCounts[update.status] || 0) + 1;
    });

    console.log(`Distinct orders checked: ${distinctOrders.size}`);
    console.log('Status breakdown:', statusCounts);

    // 4. List a few non-exception updates if any
    const delivered = recentUpdates.filter(u => u.status === 'DELIVERED');
    if (delivered.length > 0) {
        console.log('\n--- DELIVERED Orders ---');
        delivered.forEach(u => console.log(`Order ${u.orderId} (${u.order?.trackingNumber}): DELIVERED`));
    } else {
        console.log('\nNo orders were marked as DELIVERED in this run.');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
