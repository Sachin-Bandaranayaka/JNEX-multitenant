import { NextResponse } from 'next/server';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';

export const dynamic = 'force-dynamic'; // Make sure this is not cached

export async function GET(request: Request) {
    try {
        // Get the tenant and search params from the query string
        const url = new URL(request.url);
        const tenant = url.searchParams.get('tenant');
        const search = url.searchParams.get('search');

        // Set up the provider with working credentials
        const testEmail = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_EMAIL || 'janithbh123@gmail.com';
        const testPassword = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_PASSWORD || '905611623';
        const apiKey = `${testEmail}:${testPassword}`;
        const provider = new RoyalExpressProvider(apiKey);

        console.log('Fetching states with tenant:', tenant || 'default');

        // Build the query parameters for the states endpoint
        let endpoint = '/merchant/state';
        const queryParams = [];

        if (search) {
            queryParams.push(`filter[name]=${encodeURIComponent(search)}`);
        }

        // Add additional query parameters
        queryParams.push('noPagination=true'); // Get all states without pagination

        // Add the query parameters to the endpoint
        if (queryParams.length > 0) {
            endpoint += `?${queryParams.join('&')}`;
        }

        // Make the API request to get states
        const response = await provider.makeApiRequest(endpoint, 'GET');

        // Format the response for the frontend
        const states = Array.isArray(response?.data)
            ? response.data.map((state: any) => ({
                id: state.id,
                name: state.name,
                ref_no: state.ref_no,
                country_id: state.country_id,
                has_child: state.has_child
            }))
            : [];

        return NextResponse.json({
            status: 'success',
            message: 'States retrieved successfully',
            states: states
        });
    } catch (error) {
        console.error('Error fetching states:', error);
        return NextResponse.json({
            status: 'error',
            message: 'Failed to fetch states',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}