import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for recent tracking updates...');

    // 1. Get the most recent tracking updates
    const recentUpdates = await prisma.trackingUpdate.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: {
            order: {
                select: { id: true, trackingNumber: true, shippingProvider: true }
            }
        }
    });

    console.log('\n--- Recent Tracking Updates ---');
    if (recentUpdates.length === 0) {
        console.log('No tracking updates found.');
    } else {
        recentUpdates.forEach(update => {
            console.log(`Time: ${update.timestamp.toISOString()}`);
            console.log(`Order ID: ${update.orderId}`);
            console.log(`Provider: ${update.order?.shippingProvider}`);
            console.log(`Tracking Number: ${update.order?.trackingNumber}`);
            console.log(`Status: ${update.status}`);
            console.log(`Reason: ${update.description}`);
            console.log('-----------------------------------');
        });
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
