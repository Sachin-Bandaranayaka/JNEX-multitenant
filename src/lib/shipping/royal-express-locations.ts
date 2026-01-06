import { RoyalExpressProvider } from './royal-express';

export interface RoyalExpressCity {
    id: number;
    name: string;
    state: string;
}

export interface RoyalExpressState {
    id: number;
    name: string;
}

// Fallback data for cities in case API fails
export const FALLBACK_ROYAL_EXPRESS_CITIES: RoyalExpressCity[] = [
    // Colombo
    { id: 1001, name: "Colombo 01", state: "Colombo" },
    { id: 1002, name: "Colombo 02", state: "Colombo" },
    { id: 1003, name: "Colombo 03", state: "Colombo" },
    { id: 1004, name: "Colombo 04", state: "Colombo" },
    { id: 1005, name: "Colombo 05", state: "Colombo" },
    { id: 1006, name: "Colombo 06", state: "Colombo" },
    { id: 1007, name: "Colombo 07", state: "Colombo" },
    { id: 1008, name: "Colombo 08", state: "Colombo" },
    { id: 1009, name: "Colombo 09", state: "Colombo" },
    { id: 1010, name: "Colombo 10", state: "Colombo" },
    { id: 1011, name: "Colombo 11", state: "Colombo" },
    { id: 1012, name: "Colombo 12", state: "Colombo" },
    { id: 1013, name: "Colombo 13", state: "Colombo" },
    { id: 1014, name: "Colombo 14", state: "Colombo" },
    { id: 1015, name: "Colombo 15", state: "Colombo" },
    { id: 1016, name: "Dehiwala", state: "Colombo" },
    { id: 1017, name: "Mount Lavinia", state: "Colombo" },
    { id: 1018, name: "Ratmalana", state: "Colombo" },
    { id: 1019, name: "Moratuwa", state: "Colombo" },
    { id: 1020, name: "Piliyandala", state: "Colombo" },
    { id: 1021, name: "Maharagama", state: "Colombo" },
    { id: 1022, name: "Nugegoda", state: "Colombo" },
    { id: 1023, name: "Battaramulla", state: "Colombo" },
    // Kandy
    { id: 2001, name: "Kandy", state: "Kandy" },
    { id: 2002, name: "Katugastota", state: "Kandy" },
    { id: 2003, name: "Peradeniya", state: "Kandy" },
    // Galle
    { id: 3001, name: "Galle", state: "Galle" },
    { id: 3002, name: "Hikkaduwa", state: "Galle" },
    // Gampaha
    { id: 4001, name: "Gampaha", state: "Gampaha" },
    { id: 4002, name: "Negombo", state: "Gampaha" },
    { id: 4003, name: "Ja-Ela", state: "Gampaha" },
    { id: 4004, name: "Kadawatha", state: "Gampaha" },
    { id: 4005, name: "Kiribathgoda", state: "Gampaha" },
    { id: 4006, name: "Wattala", state: "Gampaha" },
    { id: 4007, name: "Nittambuwa", state: "Gampaha" },
    { id: 4008, name: "Minuwangoda", state: "Gampaha" },
    { id: 4009, name: "Divulapitiya", state: "Gampaha" },
    { id: 4010, name: "Mirigama", state: "Gampaha" },
    // Colombo Suburbs - move these to Colombo state
    { id: 5001, name: "Aggona", state: "Colombo" },
    { id: 5002, name: "Kaduwela", state: "Colombo" },
    { id: 5003, name: "Kesbewa", state: "Colombo" }
];

// Fallback data for states in case API fails
export const FALLBACK_ROYAL_EXPRESS_STATES: RoyalExpressState[] = [
    { id: 1, name: "Colombo" },
    { id: 2, name: "Kandy" },
    { id: 3, name: "Galle" },
    { id: 4, name: "Gampaha" },
    { id: 5, name: "Ampara" },
    { id: 6, name: "Anuradhapura" },
    { id: 7, name: "Badulla" },
    { id: 8, name: "Batticaloa" },
    { id: 9, name: "Hambantota" },
    { id: 10, name: "Jaffna" },
    { id: 11, name: "Kalutara" },
    { id: 12, name: "Kegalle" }
];

// Valid rate card combinations from the Royal Express dashboard
// Based on the rate card showing Kotte origin with specific destination zones
export const VALID_RATE_CARD_COMBINATIONS = [
    { origin: "Kotte", destinations: ["colombo", "Greater Colombo", "Suburbs", "Zone - 01", "Zone - 02"] },
    // Add more origins if needed
];

// Map city names to their respective zones for rate card validation
export const CITY_TO_ZONE_MAP: { [key: string]: string } = {
    // Colombo zone mapping
    "Colombo 01": "Zone - 01",
    "Colombo 02": "Zone - 02",
    "Colombo 03": "colombo",
    "Colombo 04": "colombo",
    "Colombo 05": "colombo",
    "Colombo 06": "colombo",
    "Colombo 07": "colombo",
    "Colombo 08": "colombo",
    "Colombo 09": "colombo",
    "Colombo 10": "colombo",
    "Colombo 11": "colombo",
    "Colombo 12": "colombo",
    "Colombo 13": "colombo",
    "Colombo 14": "colombo",
    "Colombo 15": "colombo",

    // Greater Colombo mapping
    "Dehiwala": "Greater Colombo",
    "Mount Lavinia": "Greater Colombo",
    "Ratmalana": "Greater Colombo",
    "Moratuwa": "Greater Colombo",
    "Piliyandala": "Greater Colombo",
    "Maharagama": "Greater Colombo",
    "Nugegoda": "Greater Colombo",
    "Battaramulla": "Greater Colombo",

    // Suburbs mapping
    "Aggona": "Suburbs",
    "Kaduwela": "Suburbs",
    "Kesbewa": "Suburbs",

    // Map other cities to appropriate zones
    "Ja-Ela": "Suburbs",
    "Gampaha": "Suburbs",
    "Kadawatha": "Greater Colombo",
    "Kiribathgoda": "Greater Colombo",
    "Wattala": "Greater Colombo",

    // Add more mappings as needed
};

/**
 * Check if a shipping origin-destination combination is valid according to the rate card
 */
export function isValidRateCardCombination(originCity: string, destinationCity: string): boolean {
    // Default origin is Kotte
    const defaultOrigin = "Kotte";

    // Get the zone for the destination city
    const destinationZone = CITY_TO_ZONE_MAP[destinationCity];
    if (!destinationZone) {
        console.warn(`No zone mapping found for destination city: ${destinationCity}`);
        return false;
    }

    // Find the valid combination for the origin
    const validCombination = VALID_RATE_CARD_COMBINATIONS.find(
        combo => combo.origin === (originCity || defaultOrigin)
    );

    if (!validCombination) {
        console.warn(`No valid combinations found for origin: ${originCity || defaultOrigin}`);
        return false;
    }

    // Check if the destination zone is in the list of valid destinations
    const isValid = validCombination.destinations.includes(destinationZone);
    console.log(`Checking if ${originCity || defaultOrigin} to ${destinationCity} (${destinationZone}) is valid: ${isValid}`);
    return isValid;
}

// Cached data

export class RoyalExpressLocations {
    private royalExpress: RoyalExpressProvider;
    private states: RoyalExpressState[] | null = null;
    private cities: RoyalExpressCity[] | null = null;

    constructor(royalExpress: RoyalExpressProvider) {
        this.royalExpress = royalExpress;
    }

    /**
     * Fetch all states from Royal Express API
     */
    async getStates(): Promise<RoyalExpressState[]> {
        if (this.states) {
            return this.states;
        }

        try {
            // Use the new direct API endpoint for states
            const response = await this.royalExpress.getStates();

            if (!response || !response.data || !Array.isArray(response.data)) {
                throw new Error('Invalid response format from Royal Express States API');
            }

            this.states = response.data.map((state: any) => ({
                id: state.id,
                name: state.name
            }));

            console.log(`Successfully fetched ${this.states?.length || 0} states from Royal Express API`);
            return this.states || FALLBACK_ROYAL_EXPRESS_STATES;
        } catch (error) {
            console.error('Failed to fetch states from Royal Express API, using fallback data:', error);
            this.states = FALLBACK_ROYAL_EXPRESS_STATES;
            return this.states;
        }
    }

    /**
     * Fetch all cities from Royal Express API
     * Uses the states endpoint which includes embedded cities for better performance
     */
    async getCities(): Promise<RoyalExpressCity[]> {
        if (this.cities && this.cities.length > 0) {
            return this.cities;
        }

        try {
            // The states endpoint includes embedded cities for each state
            // This is much more efficient than paginating through 190+ pages of cities
            const statesResponse = await this.royalExpress.getStates();

            if (!statesResponse || !statesResponse.data || !Array.isArray(statesResponse.data)) {
                throw new Error('Invalid response format from Royal Express States API');
            }

            const allCities: RoyalExpressCity[] = [];

            // Extract cities from each state
            for (const state of statesResponse.data) {
                if (state.cities && Array.isArray(state.cities)) {
                    for (const city of state.cities) {
                        allCities.push({
                            id: city.id,
                            name: city.name,
                            state: state.name
                        });
                    }
                }
            }

            if (allCities.length > 0) {
                console.log(`Successfully extracted ${allCities.length} cities from states data`);
                this.cities = allCities;
                return this.cities;
            }

            // Fallback: If states don't have embedded cities, try paginated city endpoint
            console.log('No embedded cities in states response, falling back to paginated city API');
            return await this.getCitiesPaginated();
        } catch (error) {
            console.error('Failed to fetch cities from Royal Express API, using fallback data:', error);
            this.cities = FALLBACK_ROYAL_EXPRESS_CITIES;
            return this.cities;
        }
    }

    /**
     * Fetch all cities using pagination (slower, used as fallback)
     */
    private async getCitiesPaginated(): Promise<RoyalExpressCity[]> {
        try {
            const states = await this.getStates();
            const stateMap = new Map(states.map(state => [state.id, state.name]));

            const allCities: RoyalExpressCity[] = [];
            let currentPage = 1;
            let hasMorePages = true;

            // Fetch all pages (with a safety limit)
            while (hasMorePages && currentPage <= 200) {
                const response = await this.royalExpress.makeApiRequest(`/merchant/city?page=${currentPage}`, 'GET');

                if (!response || !response.data || !Array.isArray(response.data)) {
                    break;
                }

                // Process cities from this page
                for (const city of response.data) {
                    let stateName = 'Unknown';
                    if (city.state_id && stateMap.has(city.state_id)) {
                        stateName = stateMap.get(city.state_id) || 'Unknown';
                    } else if (city.state && city.state.name) {
                        stateName = city.state.name;
                    }

                    allCities.push({
                        id: city.id,
                        name: city.name,
                        state: stateName
                    });
                }

                // Check if there are more pages
                if (response.meta && response.meta.current_page < response.meta.last_page) {
                    currentPage++;
                } else {
                    hasMorePages = false;
                }

                // Log progress every 10 pages
                if (currentPage % 10 === 0) {
                    console.log(`Fetched ${allCities.length} cities so far (page ${currentPage})...`);
                }
            }

            console.log(`Successfully fetched ${allCities.length} cities from Royal Express API`);
            this.cities = allCities;
            return this.cities;
        } catch (error) {
            console.error('Failed to fetch paginated cities:', error);
            return FALLBACK_ROYAL_EXPRESS_CITIES;
        }
    }

    /**
     * Get cities by state name
     */
    async getCitiesByState(stateName: string): Promise<RoyalExpressCity[]> {
        try {
            const normalizedStateName = stateName.toLowerCase().trim();

            // First try to get data from the cities response that already contains embedded state information
            const response = await this.royalExpress.getStates();

            if (response?.data && Array.isArray(response.data)) {
                // Find the state in the response that matches our state name
                const stateData = response.data.find((state: any) =>
                    state.name.toLowerCase() === normalizedStateName
                );

                // If we found a matching state and it has cities embedded
                if (stateData && stateData.cities && Array.isArray(stateData.cities)) {
                    const citiesFromState = stateData.cities.map((city: any) => ({
                        id: city.id,
                        name: city.name,
                        state: stateData.name
                    }));

                    if (citiesFromState.length > 0) {
                        console.log(`Found ${citiesFromState.length} cities embedded in state data for ${stateName}`);
                        return citiesFromState;
                    }
                }
            }

            // If embedded cities approach didn't work, fall back to filtering all cities
            console.log(`No embedded cities found, falling back to filtering all cities for state: ${stateName}`);
            const allCities = await this.getCities();
            const filteredCities = allCities.filter(city =>
                city.state.toLowerCase() === normalizedStateName
            );

            if (filteredCities.length > 0) {
                return filteredCities;
            }

            // If still no results, use fallback
            console.warn(`No cities found for state ${stateName} in API data, using fallback`);
            return FALLBACK_ROYAL_EXPRESS_CITIES.filter(city =>
                city.state.toLowerCase() === normalizedStateName
            );
        } catch (error) {
            console.error(`Failed to get cities for state ${stateName}:`, error);
            // Fallback
            return FALLBACK_ROYAL_EXPRESS_CITIES.filter(city =>
                city.state.toLowerCase() === stateName.toLowerCase()
            );
        }
    }

    /**
     * Get city by ID
     */
    async getCityById(cityId: number): Promise<RoyalExpressCity | null> {
        try {
            // API endpoint for specific city
            const response = await this.royalExpress.makeApiRequest(`/merchant/city/${cityId}`, 'GET');

            if (!response || !response.data) {
                throw new Error(`City with ID ${cityId} not found`);
            }

            // Fetch state for this city
            let stateName = 'Unknown';
            try {
                if (response.data.state_id) {
                    const stateResponse = await this.royalExpress.makeApiRequest(`/merchant/state/${response.data.state_id}`, 'GET');
                    if (stateResponse && stateResponse.data && stateResponse.data.name) {
                        stateName = stateResponse.data.name;
                    }
                }
            } catch (stateError) {
                console.error(`Failed to fetch state for city ${cityId}:`, stateError);
            }

            return {
                id: response.data.id,
                name: response.data.name,
                state: stateName
            };
        } catch (error) {
            console.error(`Failed to fetch city with ID ${cityId}:`, error);
            // Try fallback
            const fallbackCity = FALLBACK_ROYAL_EXPRESS_CITIES.find(city => city.id === cityId);
            return fallbackCity || null;
        }
    }

    /**
     * Get state by ID
     */
    async getStateById(stateId: number): Promise<RoyalExpressState | null> {
        try {
            // API endpoint for specific state
            const response = await this.royalExpress.makeApiRequest(`/merchant/state/${stateId}`, 'GET');

            if (!response || !response.data) {
                throw new Error(`State with ID ${stateId} not found`);
            }

            return {
                id: response.data.id,
                name: response.data.name
            };
        } catch (error) {
            console.error(`Failed to fetch state with ID ${stateId}:`, error);
            // Try fallback
            const fallbackState = FALLBACK_ROYAL_EXPRESS_STATES.find(state => state.id === stateId);
            return fallbackState || null;
        }
    }
}



// Helper functions
export async function getAllStates(royalExpressProvider: RoyalExpressProvider): Promise<RoyalExpressState[]> {
    try {
        const locationsAPI = new RoyalExpressLocations(royalExpressProvider);

        // Fetch states directly from the API
        console.log('Fetching states from Royal Express API...');
        const states = await locationsAPI.getStates();

        if (!states || states.length === 0) {
            console.warn('No states returned from Royal Express API, using fallback data');
            return FALLBACK_ROYAL_EXPRESS_STATES;
        }

        console.log(`Successfully fetched ${states.length} states from Royal Express API`);
        return states;
    } catch (error) {
        console.error('Failed to get states, using fallback:', error);
        return FALLBACK_ROYAL_EXPRESS_STATES;
    }
}

export async function getCitiesByState(royalExpressProvider: RoyalExpressProvider, stateName: string): Promise<RoyalExpressCity[]> {
    try {
        const locationsAPI = new RoyalExpressLocations(royalExpressProvider);
        const cities = await locationsAPI.getCitiesByState(stateName);

        if (cities && cities.length > 0) {
            return cities;
        }

        // Use fallback cities filtered by state name
        console.log(`Using fallback cities for state ${stateName}`);
        const fallbackCities = FALLBACK_ROYAL_EXPRESS_CITIES.filter(city =>
            city.state.toLowerCase() === stateName.toLowerCase()
        );

        if (fallbackCities.length > 0) {
            return fallbackCities;
        }

        // Last resort: use Colombo cities if no cities found for specified state
        console.warn(`No cities found for state ${stateName}, returning Colombo cities as fallback`);
        return FALLBACK_ROYAL_EXPRESS_CITIES.filter(city =>
            city.state.toLowerCase() === 'colombo'
        );
    } catch (error) {
        console.error(`Failed to get cities for state ${stateName}, using fallback:`, error);
        return FALLBACK_ROYAL_EXPRESS_CITIES.filter(city =>
            city.state.toLowerCase() === 'colombo'
        );
    }
}

export async function getAllCities(royalExpressProvider: RoyalExpressProvider): Promise<RoyalExpressCity[]> {
    try {
        const locationsAPI = new RoyalExpressLocations(royalExpressProvider);
        // Fetch all cities
        const cities = await locationsAPI.getCities();
        return cities;
    } catch (error) {
        console.error('Failed to get all cities, using fallback:', error);
        return FALLBACK_ROYAL_EXPRESS_CITIES;
    }
}

export async function getCityById(royalExpressProvider: RoyalExpressProvider, cityId: number): Promise<RoyalExpressCity | null> {
    try {
        const locationsAPI = new RoyalExpressLocations(royalExpressProvider);
        // Fetch city by ID
        return await locationsAPI.getCityById(cityId);
    } catch (error) {
        console.error(`Failed to get city with ID ${cityId}, using fallback:`, error);
        return FALLBACK_ROYAL_EXPRESS_CITIES.find(city => city.id === cityId) || null;
    }
}

/**
 * Get a list of all valid state names from the Royal Express API
 * Useful for debugging and providing helpful error messages
 * @returns Array of valid state names
 */
export async function getValidStateNames(royalExpressProvider: RoyalExpressProvider): Promise<string[]> {
    try {
        // Get all states
        const states = await getAllStates(royalExpressProvider);

        // Extract just the names and sort them alphabetically
        const stateNames = states.map(state => state.name).sort();

        console.log('Valid Royal Express state names:', stateNames.join(', '));
        return stateNames;
    } catch (error) {
        console.error('Error getting valid state names:', error);
        // Return fallback state names
        return FALLBACK_ROYAL_EXPRESS_STATES.map(state => state.name).sort();
    }
}