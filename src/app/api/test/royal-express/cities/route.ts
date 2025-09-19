import { NextResponse } from 'next/server';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';

export const dynamic = 'force-dynamic'; // Make sure this is not cached

export async function GET(request: Request) {
    try {
        // Get the tenant and search params from the query string
        const url = new URL(request.url);
        const tenant = url.searchParams.get('tenant');
        const search = url.searchParams.get('search');
        const stateId = url.searchParams.get('state_id');

        // Set up the provider with working credentials
        const testEmail = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_EMAIL || 'janithbh123@gmail.com';
        const testPassword = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_PASSWORD || '905611623';
        const apiKey = `${testEmail}:${testPassword}`;
        const provider = new RoyalExpressProvider(apiKey);

        console.log('Fetching cities with tenant:', tenant || 'default');

        // Build the query parameters for the cities endpoint
        let endpoint = '/merchant/city';
        const queryParams = [];

        if (search) {
            queryParams.push(`filter[name]=${encodeURIComponent(search)}`);
        }

        if (stateId) {
            queryParams.push(`filter[state_id]=${stateId}`);
            console.log(`Filtering cities by state ID: ${stateId}`);
        }

        // Add additional filtering if needed
        queryParams.push('filter[is_active]=true');

        // Request without pagination if filtering by state to get all cities in a state
        if (stateId) {
            queryParams.push('noPagination=true');
        }

        // Add the query parameters to the endpoint
        if (queryParams.length > 0) {
            endpoint += `?${queryParams.join('&')}`;
        }

        // Make the API request to get cities
        const response = await provider.makeApiRequest(endpoint, 'GET');

        // Format the response for the frontend
        const cities = response?.data?.map((city: any) => ({
            id: city.id,
            name: city.name,
            state_id: city.state_id,
            state: city.state ? {
                id: city.state.id,
                name: city.state.name
            } : undefined
        })) || [];

        return NextResponse.json({
            status: 'success',
            message: 'Cities retrieved successfully',
            cities: cities
        });
    } catch (error) {
        console.error('Error fetching cities:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Failed to fetch cities',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}