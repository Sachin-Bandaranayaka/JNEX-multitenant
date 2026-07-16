import { NextRequest, NextResponse } from 'next/server';
import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { TransExpressLocations } from '@/lib/shipping/trans-express-locations';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface ResolvedCity {
    city: { id: number; text: string; district_id: number };
    district: { id: number; text: string };
}

// Trans Express omits district_id from its unfiltered /cities response. Keep
// resolved relationships in memory so subsequent selections do not rescan the
// courier's district endpoints during this server process.
const resolvedCityCache = new Map<string, Map<number, ResolvedCity>>();

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
                transExpressApiKey: true,
            },
        });

        if (!tenant || !tenant.transExpressApiKey) {
            return NextResponse.json(
                { error: 'Trans Express API key not configured' },
                { status: 400 }
            );
        }

        // Initialize the Trans Express provider
        const transExpress = new TransExpressProvider(tenant.transExpressApiKey);

        // Initialize the locations API
        const locationsAPI = new TransExpressLocations(transExpress);

        // Get district_id from query params if available
        const searchParams = request.nextUrl.searchParams;
        const districtId = searchParams.get('district_id');
        const cityId = searchParams.get('city_id');

        if (cityId) {
            const numericCityId = Number(cityId);
            if (!Number.isInteger(numericCityId) || numericCityId <= 0) {
                return NextResponse.json({ error: 'Invalid city_id' }, { status: 400 });
            }

            const tenantCache = resolvedCityCache.get(tenantId) || new Map<number, ResolvedCity>();
            resolvedCityCache.set(tenantId, tenantCache);
            const cached = tenantCache.get(numericCityId);
            if (cached) return NextResponse.json(cached, { status: 200 });

            const districts = await locationsAPI.getDistricts();

            // Resolve in small batches to keep selection responsive without
            // flooding the courier API or exceeding its request-rate limits.
            for (let index = 0; index < districts.length; index += 5) {
                const batch = districts.slice(index, index + 5);
                const cityGroups = await Promise.all(batch.map(async (district) => ({
                    district,
                    cities: await locationsAPI.getCitiesByDistrictId(Number(district.id)),
                })));

                for (const { district, cities } of cityGroups) {
                    for (const city of cities) {
                        const resolved: ResolvedCity = {
                            city: {
                                id: Number(city.id),
                                text: city.text,
                                district_id: Number(district.id),
                            },
                            district: {
                                id: Number(district.id),
                                text: district.text,
                            },
                        };
                        tenantCache.set(resolved.city.id, resolved);
                    }
                }

                const match = tenantCache.get(numericCityId);
                if (match) return NextResponse.json(match, { status: 200 });
            }

            return NextResponse.json({ error: 'City district not found' }, { status: 404 });
        }

        let cities;

        if (districtId && !isNaN(Number(districtId))) {
            // If district_id is provided, get cities for that district
            cities = await locationsAPI.getCitiesByDistrictId(Number(districtId));
        } else {
            // Otherwise, get all cities
            cities = await locationsAPI.getCities();
        }

        // Return the cities
        return NextResponse.json({ cities }, { status: 200 });
    } catch (error) {
        console.error('Error fetching cities:', error);
        return NextResponse.json(
            { error: 'Failed to fetch cities' },
            { status: 500 }
        );
    }
}
