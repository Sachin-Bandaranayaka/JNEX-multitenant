export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { getValidStateNames } from '@/lib/shipping/royal-express-locations';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/shipping/royal-express/states
 * Fetch all valid states from Royal Express API
 */
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

        // First try using the getValidStateNames helper
        const stateNames = await getValidStateNames(royalExpressService);

        if (stateNames && stateNames.length > 0) {
            return NextResponse.json({
                message: 'States retrieved successfully using helper function',
                states: stateNames
            });
        }

        // If that fails, try direct API call (this part might be redundant after refactoring)
        console.log('Helper function did not return states, trying direct API call');
        // Note: RoyalExpressProvider.fetchValidStates() might still use env vars, consider removing or updating it.
        const directStates = await RoyalExpressProvider.fetchValidStates();

        if (directStates && directStates.length > 0) {
            return NextResponse.json({
                message: 'States retrieved directly from API',
                states: directStates
            });
        }

        // If both methods fail, return an error
        return NextResponse.json({
            message: 'Failed to retrieve states from Royal Express API',
            states: []
        }, { status: 500 });
    } catch (error) {
        console.error('Error retrieving Royal Express states:', error);

        return NextResponse.json({
            message: 'Error retrieving states',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}