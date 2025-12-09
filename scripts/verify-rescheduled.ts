import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying Rescheduled Status Implementation...');

    // 1. Check if RESCHEDULED exists in OrderStatus enum (via Prisma)
    // We can't easily check the enum definition at runtime without using it, 
    // so we'll try to find an order and update it to RESCHEDULED.

    // Find a test order (or the one we were looking at: RA02361192)
    const trackingNumber = 'RA02361192';
    const order = await prisma.order.findFirst({
        where: { trackingNumber }
    });

    if (!order) {
        console.error(`Order with tracking number ${trackingNumber} not found.`);
        return;
    }

    console.log(`Found order: ${order.id} (Current Status: ${order.status})`);

    // Note: We are NOT actually updating the database here to avoid messing up real data 
    // unless we are sure. But since the user wants this feature, the cron job will update it 
    // automatically on the next run.

    // Instead, let's just check if the Prisma Client accepts the RESCHEDULED status in a query.
    try {
        const count = await prisma.order.count({
            where: { status: 'RESCHEDULED' }
        });
        console.log(`Successfully queried for RESCHEDULED status. Count: ${count}`);
        console.log('Database schema update appears successful.');
    } catch (error) {
        console.error('Error querying RESCHEDULED status:', error);
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
