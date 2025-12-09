import { RoyalExpressProvider } from '../src/lib/shipping/royal-express';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    const trackingNumber = 'RA02361192'; // Real tracking number from database
    console.log(`Testing Royal Express tracking for: ${trackingNumber}`);

    const apiKey = process.env.ROYAL_EXPRESS_API_KEY || process.env.NEXT_PUBLIC_ROYAL_EXPRESS_API_KEY;
    if (!apiKey) {
        console.error('ROYAL_EXPRESS_API_KEY not found in env');
        return;
    }

    console.log('Using API Key:', apiKey);

    const provider = new RoyalExpressProvider(apiKey, 'royalexpress');

    try {
        // 1. Test basic tracking
        console.log('\n--- Testing trackShipment ---');
        const status = await provider.trackShipment(trackingNumber);
        console.log('Result Status:', status);

        // 2. Test enhanced tracking (if it exists on the instance)
        if ('trackShipmentEnhanced' in provider) {
            console.log('\n--- Testing trackShipmentEnhanced ---');
            // @ts-ignore
            const enhanced = await provider.trackShipmentEnhanced(trackingNumber);
            console.log('Enhanced Result:', JSON.stringify(enhanced, null, 2));
        } else {
            console.log('\n(trackShipmentEnhanced method not found on provider)');
        }

    } catch (error) {
        console.error('Error during test:', error);
    }
}

main();
