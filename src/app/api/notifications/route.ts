import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: {
                tenantId: session.user.tenantId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 20, // Limit to last 20 notifications
        });

        return NextResponse.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await request.json();
        const { id, markAllRead } = body;

        if (markAllRead) {
            await prisma.notification.updateMany({
                where: {
                    tenantId: session.user.tenantId,
                    read: false,
                },
                data: {
                    read: true,
                },
            });
        } else if (id) {
            await prisma.notification.update({
                where: {
                    id,
                    tenantId: session.user.tenantId,
                },
                data: {
                    read: true,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notification:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
