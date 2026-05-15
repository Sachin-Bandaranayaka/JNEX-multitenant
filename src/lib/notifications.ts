import { prisma } from '@/lib/prisma';

export type NotificationType = 'DELIVERY' | 'RETURN' | 'SYSTEM';

export async function createNotification(
    tenantId: string,
    title: string,
    description: string,
    type: NotificationType,
    orderId?: string
) {
    try {
        await prisma.notification.create({
            data: {
                tenantId,
                title,
                description,
                type,
                orderId,
            },
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}
