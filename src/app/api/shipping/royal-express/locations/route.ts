import { NextRequest, NextResponse } from 'next/server';
import { getAllStates, getCitiesByState, getAllCities } from '@/lib/shipping/royal-express-locations';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const tenantId = session.user.tenantId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                royalExpressApiKey: true,
            },
        });

        if (!tenant || !tenant.royalExpressApiKey) {
            return NextResponse.json(
                { error: 'Royal Express API key not configured for this tenant' },
                { status: 500 }
            );
        }

        const [royalEmail, royalPassword] = tenant.royalExpressApiKey.split(':');
        if (!royalEmail || !royalPassword) {
            return NextResponse.json(
                { error: 'Royal Express API key format invalid (expected email:password)' },
                { status: 500 }
            );
        }

        // Pass the full API key string (email:password), not separate values
        const royalExpressService = new RoyalExpressProvider(tenant.royalExpressApiKey);

        const url = new URL(request.url);
        const state = url.searchParams.get('state');

        if (state) {
            // If a specific state is requested, return cities for that state
            const cities = await getCitiesByState(royalExpressService, state);
            return NextResponse.json({ cities }, { status: 200 });
        } else {
            // Otherwise return all states and cities
            const [states, cities] = await Promise.all([
                getAllStates(royalExpressService),
                getAllCities(royalExpressService)
            ]);
            return NextResponse.json({ states, cities }, { status: 200 });
        }
    } catch (error) {
        console.error('Error fetching Royal Express locations:', error);
        return NextResponse.json(
            { error: 'Failed to fetch location data from Royal Express' },
            { status: 500 }
        );
    }
} 