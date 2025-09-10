import {
    ShippingProvider,
    ShippingAddress,
    PackageDetails,
    ShippingRate,
    ShippingLabel,
    ShipmentStatus,
} from './types';
import { getValidStateNames } from './royal-express-locations';

interface CurfoxAuthResponse {
    user: any;
    token: string;
    message: string;
}

export class RoyalExpressProvider implements ShippingProvider {
    private apiKey!: string;
    private email!: string;
    private password!: string;
    private apiUrl!: string;
    private tenant!: string;
    private authToken: string | null = null;
    private readonly CREATE_SHIPMENT_ENDPOINT = '/shipments';
    private readonly TRACK_SHIPMENT_ENDPOINT = '/tracking';
    private readonly LOCATIONS_ENDPOINT = '/locations';

    constructor(royalExpressApiKey: string, tenant?: string) {
        // Split the API key into email and password (format: email:password)
        const [email, password] = royalExpressApiKey.split(':');
        if (!email || !password) {
            // Fallback to environment variables if the API key format is invalid
            this.email = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_EMAIL || process.env.ROYAL_EXPRESS_EMAIL || '';
            this.password = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_PASSWORD || process.env.ROYAL_EXPRESS_PASSWORD || '';
        } else {
            this.email = email;
            this.password = password;
        }
        this.apiKey = royalExpressApiKey;
        this.apiUrl = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_API_URL || 'https://v1.api.curfox.com/api/public';
        this.tenant = tenant || 'royalexpress'; // Default to 'royalexpress' if not provided
        console.log('Initialized Royal Express (Curfox DMS) provider with API URL:', this.apiUrl);
        console.log('Using tenant:', this.tenant);
    }

    getName(): string {
        return 'Royal Express';
    }

    // Authenticate with the Curfox API
    private async authenticate(): Promise<string> {
        if (this.authToken) {
            return this.authToken;
        }

        try {
            console.log('Authenticating with Curfox DMS API...');

            const response = await fetch(`${this.apiUrl}/merchant/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-tenant': this.tenant,
                },
                body: JSON.stringify({
                    email: this.email,
                    password: this.password
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Authentication failed: HTTP error! status: ${response.status}, body: ${errorText}`);
                throw new Error(`Authentication failed: HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const authData = await response.json() as CurfoxAuthResponse;

            if (authData.message !== 'success' || !authData.token) {
                throw new Error(`Authentication failed: ${authData.message}`);
            }

            console.log('Successfully authenticated with Curfox DMS API');
            this.authToken = authData.token;
            return this.authToken;
        } catch (error) {
            console.error('Error authenticating with Curfox DMS:', error);
            throw error instanceof Error ? error : new Error('Failed to authenticate with Curfox DMS');
        }
    }

    // Public method to make API requests that can be used by other classes
    public async makeApiRequest(endpoint: string, method: string, data?: any) {
        return this.makeRequest(endpoint, method, data);
    }

    private async makeRequest(endpoint: string, method: string, data?: any) {
        try {
            const token = await this.authenticate();

            console.log(`Sending ${method} request to Curfox DMS:`, {
                endpoint: this.apiUrl + endpoint,
                data: data ? JSON.stringify(data) : undefined
            });

            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-tenant': this.tenant,
                    'Authorization': `Bearer ${token}`,
                },
                body: data ? JSON.stringify(data) : undefined,
            });

            console.log('Curfox DMS response status:', response.status);
            const responseText = await response.text();
            console.log('Curfox DMS raw response:', responseText);

            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}, body: ${responseText}`);
                throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
            }

            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse Curfox DMS response:', e);
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            console.log('Parsed Curfox DMS response:', responseData);
            return responseData;
        } catch (error) {
            console.error('Curfox DMS API Error:', error);
            // If auth error, clear the token to force re-authentication
            if (error instanceof Error && error.message.includes('Authentication failed')) {
                this.authToken = null;
            }
            throw error instanceof Error ? error : new Error('Failed to make request to Curfox DMS');
        }
    }

    async getRates(
        origin: ShippingAddress,
        destination: ShippingAddress,
        packageDetails: PackageDetails
    ): Promise<ShippingRate[]> {
        // For now, return static rates based on common courier pricing
        // In a real implementation, you would call the Curfox DMS API to get actual rates
        return [
            {
                provider: this.getName(),
                service: 'Standard',
                rate: 380,
                estimatedDays: 3,
            },
            {
                provider: this.getName(),
                service: 'Express',
                rate: 480,
                estimatedDays: 1,
            }
        ];
    }

    async createShipment(
        origin: ShippingAddress,
        destination: ShippingAddress,
        packageDetails: PackageDetails,
        service: string,
        cityId?: number,
        districtId?: number,
        orderTotal?: number,
        orderPrefix?: string
    ): Promise<ShippingLabel> {
        // First get the current user info to ensure we're authenticated
        const userInfo = await this.makeRequest('/merchant/user/get-current', 'GET');

        // Get businesses for this merchant
        let business_id = 4400;
        try {
            const businessesResponse = await this.getBusinesses();
            if (businessesResponse && businessesResponse.data && businessesResponse.data.length > 0) {
                // Use the first business or the default one if available
                const defaultBusiness = businessesResponse.data.find((b: any) => b.is_default === true);
                const firstBusiness = businessesResponse.data[0];

                // Use default business if available, otherwise use the first one
                const business = defaultBusiness || firstBusiness;

                console.log('Using business:', business.business_name, 'ID:', business.id, 'Ref:', business.ref_no);
                business_id = business.id;
            } else {
                console.warn('No businesses found for this merchant, using default ID');
            }
        } catch (error) {
            console.error('Failed to fetch businesses, using default ID:', error);
        }

        // Map our data to Curfox DMS API format according to their documented API
        const waybillNumber = `JX${Math.floor(Math.random() * 10000000)}`; // Generate a random waybill number

        // Origin values exactly as configured in your rate card
        const originCity = origin.city || "Kotte";

        // Normalize state names - map known invalid states to valid ones
        let originState = this.normalizeStateName(origin.state || "Colombo");
        let destState = this.normalizeStateName(destination.state || "Colombo");

        // Destination values - must match the zones in the rate card
        const destCity = destination.city || "colombo";

        // Log the city/state combinations for debugging
        console.log(`Creating shipment with origin: ${originCity} (${originState}) to destination: ${destCity} (${destState})`);

        // Validate state names before proceeding
        try {
            const validStateNames = await getValidStateNames(this);

            // Check if normalized origin state is valid
            if (!validStateNames.includes(originState)) {
                throw new Error(`Invalid origin state name: "${originState}" is not recognized by Royal Express. 
                
Valid state names are: ${validStateNames.join(', ')}`);
            }

            // Check if normalized destination state is valid
            if (!validStateNames.includes(destState)) {
                throw new Error(`Invalid destination state name: "${destState}" is not recognized by Royal Express. 
                
Valid state names are: ${validStateNames.join(', ')}`);
            }

            console.log('State names validated successfully');
        } catch (error) {
            console.error('Error validating state names:', error);
            // We'll continue and let the API handle it if this validation fails
        }

        // Get additional user merchant info for required fields
        const merchantInfo = userInfo.data?.merchant || {};
        const merchantName = merchantInfo.name || "J Nex Holdings";

        // Format address parts 
        const street = destination.street || "";
        const city = destination.city || "";
        const postalCode = destination.postalCode || "";
        const fullAddress = [street, city, postalCode].filter(Boolean).join(", ");

        const data = {
            general_data: {
                merchant_business_id: business_id,
                origin_city_name: originCity,
                origin_state_name: originState,
                merchant_name: merchantName
            },
            order_data: [
                {
                    waybill_number: waybillNumber,
                    order_no: `${orderPrefix || 'JNEX'}-${Math.floor(Math.random() * 100000)}`,
                    customer_name: destination.name,
                    customer_address: fullAddress || destination.street || "Customer address",
                    customer_phone: destination.phone,
                    customer_secondary_phone: destination.alternatePhone || "",
                    destination_city_name: destCity,
                    destination_state_name: destState,
                    cod: orderTotal || 0,
                    description: packageDetails.description || `${packageDetails.weight}kg package`,
                    weight: packageDetails.weight,
                    remark: "Shipped via JNEX"
                }
            ]
        };

        try {
            // Endpoint matches the documentation
            const response = await this.makeRequest('/merchant/order/single', 'POST', data);

            // Check if the API call was successful
            if (!response || !response.data || response.data.length === 0) {
                throw new Error('Failed to create shipment with Curfox DMS: ' + JSON.stringify(response));
            }

            const trackingNumber = response.data[0]; // The API returns an array of created waybill numbers
            return {
                trackingNumber: trackingNumber,
                labelUrl: `https://royalexpress.merchant.curfox.com/orders/${trackingNumber}/waybill`, // URL for printing the shipping label
                provider: this.getName(),
            };
        } catch (error) {
            // Handle different error types according to API documentation
            if (error instanceof Error) {
                const errorMsg = error.message;

                // Rate card errors
                if (errorMsg.includes('rate_card.destination_city_id')) {
                    throw new Error(`Rate card error: The merchant account doesn't have a rate card set up for the specified city combination (${originCity} to ${destCity}). 
                    
This is a configuration issue on the Royal Express side. Please contact Royal Express to set up rate cards for your account with the following instructions:
1. Tell them you need rate cards for your merchant account (ID: ${business_id})
2. Specify which city combinations you need (e.g., ${originCity} to ${destCity})
3. Ask them to enable the merchant/order/single endpoint for your account
                    
For testing purposes, you may want to ask which city combinations are already set up for your account.`);
                }
                // Invalid city name errors
                else if (errorMsg.includes('origin_city_name') || errorMsg.includes('destination_city_name')) {
                    throw new Error(`Invalid city name: One of the city names provided (${originCity} or ${destCity}) is not recognized by Royal Express. 
                    
Valid city names are configured by Royal Express. Please contact them to get a list of valid city names for your account.`);
                }
                // Invalid state name errors
                else if (errorMsg.includes('origin_state_name') || errorMsg.includes('destination_state_name')) {
                    throw new Error(`Invalid state name: One of the state names provided (${originState} or ${destState}) is not recognized by Royal Express.

To see the list of valid state names, please visit: /debug/shipping/states

The state name must match exactly, including capitalization.`);
                }
                // Waybill errors
                else if (errorMsg.includes('waybill')) {
                    throw new Error(`Waybill error: The waybill format is invalid or the waybill number already exists. Details: ${errorMsg}`);
                }
                // Merchant business ID errors
                else if (errorMsg.includes('merchant_business_id')) {
                    throw new Error(`Merchant ID error: The merchant business ID ${data.general_data.merchant_business_id} is invalid. Details: ${errorMsg}`);
                }
                // Other errors
                else {
                    throw error;
                }
            } else {
                throw new Error('Unknown error when creating shipment with Royal Express');
            }
        }
    }

    async trackShipment(trackingNumber: string): Promise<ShipmentStatus> {
        try {
            // Authenticate first
            await this.authenticate();

            console.log(`Attempting to track Curfox DMS shipment: ${trackingNumber}`);

            // Use the correct endpoint for tracking according to the API
            // The documentation doesn't explicitly show a tracking endpoint, but we'll check the order status
            const response = await this.makeRequest(`/merchant/order/${trackingNumber}/status`, 'GET');

            console.log('Curfox DMS tracking response:', JSON.stringify(response, null, 2));

            // Handle empty response or different response format
            if (!response.data && response.error) {
                console.error('Error from Curfox DMS tracking:', response.error);
                return ShipmentStatus.PENDING; // Default to pending if we can't determine status
            }

            if (!response.data) {
                console.warn('No tracking data received from Curfox DMS, defaulting to PENDING');
                return ShipmentStatus.PENDING;
            }

            // Map the status from the API to our internal status enum
            // We're making educated guesses about status names since they weren't specified in the documentation
            const status = response.data.status || 'pending';
            return this.normalizeStatus(status);
        } catch (error) {
            console.error('Error tracking Curfox DMS shipment:', error);
            // Default to pending if tracking fails
            return ShipmentStatus.PENDING;
        }
    }

    private normalizeStatus(statusName: string): ShipmentStatus {
        const statusMap: { [key: string]: ShipmentStatus } = {
            'Processing': ShipmentStatus.PENDING,
            'Picked Up': ShipmentStatus.IN_TRANSIT,
            'In Transit': ShipmentStatus.IN_TRANSIT,
            'Out for Delivery': ShipmentStatus.OUT_FOR_DELIVERY,
            'Delivered': ShipmentStatus.DELIVERED,
            'Failed Delivery': ShipmentStatus.EXCEPTION,
            'Returned': ShipmentStatus.EXCEPTION,
            'Canceled': ShipmentStatus.EXCEPTION,
        };

        return statusMap[statusName] || ShipmentStatus.EXCEPTION;
    }

    getTrackingUrl(trackingNumber: string): string {
        return `https://merchant.curfox.com/tracking/${trackingNumber}`;
    }

    // Get user information from Curfox DMS
    public async getUserInfo() {
        return this.makeRequest('/merchant/user/get-current', 'GET');
    }

    // Get businesses for the logged-in merchant
    public async getBusinesses() {
        return this.makeRequest('/merchant/business?noPagination', 'GET');
    }

    // Get locations for Royal Express
    public async getLocations() {
        return this.makeRequest(this.LOCATIONS_ENDPOINT, 'GET');
    }

    /**
     * Get all states from Royal Express API
     * This uses the /api/public/merchant/state endpoint as documented
     * @param filters Optional filters to apply to the request (name, country_id)
     * @returns List of state objects from the API
     */
    public async getStates(filters?: { name?: string, country_id?: number }) {
        let endpoint = '/merchant/state';

        // Add query parameters if filters are provided
        if (filters) {
            const params = new URLSearchParams();

            if (filters.name) {
                params.append('filter[name]', filters.name);
            }

            if (filters.country_id) {
                params.append('filter[country_id]', filters.country_id.toString());
            }

            // Add noPagination to get all results
            params.append('noPagination', '');

            if (params.toString()) {
                endpoint += `?${params.toString()}`;
            }
        } else {
            // Default to noPagination to get all results
            endpoint += '?noPagination';
        }

        const response = await this.makeRequest(endpoint, 'GET');
        return response;
    }

    /**
     * Utility method to fetch and log valid states for debugging
     * This is useful to diagnose state name issues
     */
    public static async fetchValidStates() {
        try {
            // Create a temporary instance with environment variables
            const email = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_EMAIL || '';
            const password = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_PASSWORD || '';
            const tenant = process.env.NEXT_PUBLIC_ROYAL_EXPRESS_TENANT || 'developers';
            const provider = new RoyalExpressProvider(email, password);

            // Authenticate and fetch states
            console.log('Fetching valid states from Royal Express API...');
            const response = await provider.getStates();

            if (response && response.data && Array.isArray(response.data)) {
                const stateNames = response.data.map((state: any) => state.name).sort();
                console.log('Available states:', stateNames);
                return stateNames;
            } else {
                console.error('Invalid response format from States API:', response);
                return [];
            }
        } catch (error) {
            console.error('Error fetching valid states:', error);
            return [];
        }
    }

    /**
     * Normalize state names to match valid Royal Express state names
     * @param stateName The state name to normalize
     * @returns A normalized state name that is valid for Royal Express API
     */
    private normalizeStateName(stateName: string): string {
        // Map of problematic state names to valid ones
        const stateNameMap: Record<string, string> = {
            "Colombo Suburbs": "Colombo",
            "colombo": "Colombo",
            "colombo suburbs": "Colombo",
            "COLOMBO": "Colombo",
            "GALLE": "Galle",
            "galle": "Galle",
            "Western": "Colombo",
            "western": "Colombo",
            "WESTERN": "Colombo"
        };

        return stateNameMap[stateName] || stateName;
    }
}