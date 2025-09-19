// src/components/orders/shipping-form.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowTopRightOnSquareIcon as ExternalLinkIcon } from '@heroicons/react/24/outline';
import { FardaExpressService } from '@/lib/shipping/farda-express';
import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { getAllDistricts, getCitiesByDistrict, getAllCities, TransExpressCity } from '@/lib/shipping/trans-express-cities';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { getAllStates, getCitiesByState, RoyalExpressCity, RoyalExpressState } from '@/lib/shipping/royal-express-locations';
import { ShippingProvider } from '@prisma/client';

interface ShippingFormProps {
    orderId: string;
    currentProvider?: string;
    currentTrackingNumber?: string;
    order: {
        customerName: string;
        customerPhone: string;
        customerSecondPhone?: string;
        customerAddress: string;
        customerCity?: string;
        product: {
            name: string;
            price: number;
        };
        quantity: number;
        discount?: number;
    };
    fardaExpressClientId?: string;
    fardaExpressApiKey?: string;
    transExpressApiKey?: string;
    royalExpressApiKey?: string;
    royalExpressOrderPrefix?: string;
    tenantId?: string;
    onSuccess?: () => void;
}

export function ShippingForm({
    orderId,
    currentProvider,
    currentTrackingNumber,
    order,
    fardaExpressClientId,
    fardaExpressApiKey,
    transExpressApiKey,
    royalExpressApiKey,
    royalExpressOrderPrefix,
    tenantId,
    onSuccess,
}: ShippingFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [provider, setProvider] = useState(currentProvider || '');
    const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || '');
    const [weight, setWeight] = useState('1'); // Default weight in kg
    const [city, setCity] = useState('');

    // For Trans Express
    const [districts, setDistricts] = useState<string[]>([]);
    const [selectedDistrict, setSelectedDistrict] = useState<string>('Colombo'); // Default to Colombo
    const [selectedCity, setSelectedCity] = useState<number>(864); // Default to Colombo 01
    const [citiesInDistrict, setCitiesInDistrict] = useState<TransExpressCity[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [citySearchTerm, setCitySearchTerm] = useState('');
    const [filteredCities, setFilteredCities] = useState<TransExpressCity[]>([]);
    const [showCityDropdown, setShowCityDropdown] = useState(false);

    // For Royal Express
    const [states, setStates] = useState<RoyalExpressState[]>([]);
    const [selectedState, setSelectedState] = useState<string>('Colombo'); // Default to Colombo
    const [selectedRoyalCity, setSelectedRoyalCity] = useState<number>(1001); // Default to Colombo 01
    const [citiesInState, setCitiesInState] = useState<RoyalExpressCity[]>([]);
    const [isLoadingRoyalLocations, setIsLoadingRoyalLocations] = useState(false);
    const [royalCitySearchTerm, setRoyalCitySearchTerm] = useState('');
    const [filteredRoyalCities, setFilteredRoyalCities] = useState<RoyalExpressCity[]>([]);
    const [showRoyalCityDropdown, setShowRoyalCityDropdown] = useState(false);

    // Load districts when provider changes to Trans Express
    useEffect(() => {
        const loadDistricts = async () => {
            if (provider !== 'TRANS_EXPRESS') return;

            setIsLoadingLocations(true);
            try {
                console.log('Fetching Trans Express districts...');
                const allDistricts = await getAllDistricts();
                console.log('Districts loaded:', allDistricts);
                setDistricts(allDistricts);

                // Set default district to Colombo
                setSelectedDistrict('Colombo');
            } catch (err) {
                console.error('Failed to load districts:', err);
                setDistricts(['Colombo', 'Gampaha', 'Kandy']); // Fallback data
            } finally {
                setIsLoadingLocations(false);
            }
        };

        loadDistricts();
    }, [provider]);

    // Load states when provider changes to Royal Express
    useEffect(() => {
        const loadRoyalExpressStates = async () => {
            if (provider !== 'ROYAL_EXPRESS') return;

            setIsLoadingRoyalLocations(true);
            try {
                console.log('Fetching Royal Express states...');
                if (!royalExpressApiKey) {
                    console.warn('Royal Express API key not provided, skipping state fetch.');
                    setIsLoadingRoyalLocations(false);
                    return;
                }
                const royalExpressService = new RoyalExpressProvider(royalExpressApiKey);
                const allStates = await getAllStates(royalExpressService);
                console.log('States loaded:', allStates);
                setStates(allStates);

                // Set default state to Colombo
                setSelectedState('Colombo');
            } catch (err) {
                console.error('Failed to load Royal Express states:', err);
                // Use fallback data with valid state names only
                setStates([
                    { id: 1, name: 'Colombo' },
                    { id: 3, name: 'Galle' },
                    { id: 4, name: 'Gampaha' }
                ]);
                // Set default to a known valid state
                setSelectedState('Colombo');
            } finally {
                setIsLoadingRoyalLocations(false);
            }
        };

        loadRoyalExpressStates();
    }, [provider]);

    // Update cities when district changes for Trans Express
    useEffect(() => {
        const updateCities = async () => {
            if (provider !== 'TRANS_EXPRESS' || !selectedDistrict) return;

            setIsLoadingLocations(true);
            try {
                console.log(`Fetching cities for district: ${selectedDistrict}`);
                const cities = await getCitiesByDistrict(selectedDistrict);
                console.log('Cities loaded:', cities);
                setCitiesInDistrict(cities);

                // Set default city if available
                if (cities.length > 0) {
                    console.log(`Setting default city to: ${cities[0].name} (${cities[0].id})`);
                    setSelectedCity(cities[0].id);
                    // Set the search term to the selected city name
                    setCitySearchTerm(cities[0].name);
                } else {
                    console.warn(`No cities found for district ${selectedDistrict}, using fallback cities`);
                    // If no cities are found, use the fallback cities from Colombo
                    const fallbackCities = await getCitiesByDistrict('Colombo');
                    if (fallbackCities.length > 0) {
                        console.log('Using fallback cities from Colombo');
                        setCitiesInDistrict([
                            { id: fallbackCities[0].id, name: fallbackCities[0].name, district: selectedDistrict }
                        ]);
                        setSelectedCity(fallbackCities[0].id);
                        // Set the search term to the selected city name
                        setCitySearchTerm(fallbackCities[0].name);
                    }
                }
            } catch (err) {
                console.error('Failed to load cities for district:', err);
                // Use a default city from the fallback data
                setCitiesInDistrict([{ id: 864, name: 'Colombo 01', district: selectedDistrict }]);
                setSelectedCity(864);
                // Set the search term to the default city name
                setCitySearchTerm('Colombo 01');
            } finally {
                setIsLoadingLocations(false);
            }
        };

        updateCities();
    }, [selectedDistrict, provider]);

    // Update cities when state changes for Royal Express
    useEffect(() => {
        const updateRoyalCities = async () => {
            if (provider !== 'ROYAL_EXPRESS' || !selectedState) return;

            setIsLoadingRoyalLocations(true);
            try {
                if (!royalExpressApiKey) {
                    console.warn('Royal Express API key not provided, skipping city fetch.');
                    setIsLoadingRoyalLocations(false);
                    return;
                }
                const royalExpressService = new RoyalExpressProvider(royalExpressApiKey);
                console.log(`Fetching cities for state: ${selectedState}`);
                const cities = await getCitiesByState(royalExpressService, selectedState);
                console.log('Royal Express cities loaded:', cities);
                setCitiesInState(cities);

                // Set default city if available
                if (cities.length > 0) {
                    console.log(`Setting default Royal Express city to: ${cities[0].name} (${cities[0].id})`);
                    setSelectedRoyalCity(cities[0].id);
                    // Set the search term to the selected city name
                    setRoyalCitySearchTerm(cities[0].name);
                } else {
                    console.warn(`No cities found for state ${selectedState}, using fallback cities`);
                    // Use hardcoded fallback cities
                    setCitiesInState([
                        { id: 1001, name: 'Colombo 01', state: selectedState }
                    ]);
                    setSelectedRoyalCity(1001);
                    setRoyalCitySearchTerm('Colombo 01');
                }
            } catch (err) {
                console.error(`Failed to load cities for state ${selectedState}:`, err);
                // Use a default city from the fallback data
                setCitiesInState([{ id: 1001, name: 'Colombo 01', state: selectedState }]);
                setSelectedRoyalCity(1001);
                setRoyalCitySearchTerm('Colombo 01');
            } finally {
                setIsLoadingRoyalLocations(false);
            }
        };

        updateRoyalCities();
    }, [selectedState, provider]);

    // Filter cities based on search term for Trans Express
    useEffect(() => {
        if (citySearchTerm.trim() === '') {
            setFilteredCities(citiesInDistrict);
        } else {
            const filtered = citiesInDistrict.filter(city =>
                city.name.toLowerCase().includes(citySearchTerm.toLowerCase())
            );
            setFilteredCities(filtered);
        }
    }, [citySearchTerm, citiesInDistrict]);

    // Filter cities based on search term for Royal Express
    useEffect(() => {
        if (royalCitySearchTerm.trim() === '') {
            setFilteredRoyalCities(citiesInState);
        } else {
            const filtered = citiesInState.filter(city =>
                city.name.toLowerCase().includes(royalCitySearchTerm.toLowerCase())
            );
            setFilteredRoyalCities(filtered);
        }
    }, [royalCitySearchTerm, citiesInState]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // Close Trans Express city dropdown
            if (!target.closest('.city-dropdown-container')) {
                setShowCityDropdown(false);
            }
            // Close Royal Express city dropdown
            if (!target.closest('.royal-city-dropdown-container')) {
                setShowRoyalCityDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Clear city search term when state changes
    useEffect(() => {
        if (provider === 'ROYAL_EXPRESS' && selectedState) {
            // Reset the search term when state changes
            setRoyalCitySearchTerm('');
            setShowRoyalCityDropdown(false);
        }
    }, [selectedState, provider]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (provider === ShippingProvider.FARDA_EXPRESS) {
                if (!fardaExpressClientId || !fardaExpressApiKey) {
                    throw new Error('Farda Express credentials not provided.');
                }
                const fardaService = new FardaExpressService(fardaExpressClientId, fardaExpressApiKey);
                const timestamp = new Date().getTime().toString().slice(-6);
                const uniqueId = orderId.slice(0, 4).toUpperCase();
                const formattedOrderId = `JH${timestamp}${uniqueId}`;

                // Calculate the discounted amount for COD (Cash on Delivery)
                const codAmount = (order.product.price * order.quantity) - (order.discount || 0);

                console.log('Farda Express config:', {
                    clientId: process.env.NEXT_PUBLIC_FARDA_EXPRESS_CLIENT_ID,
                    apiEndpoint: 'https://www.fdedomestic.com/api/parcel/new_api_v1.php',
                    orderId: formattedOrderId,
                    weight,
                    customerDetails: {
                        name: order.customerName,
                        phone: order.customerPhone,
                        address: order.customerAddress,
                        city: city || order.customerCity || '',
                    },
                    codAmount,
                });

                const result = await fardaService.createShipment(
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: city || order.customerCity || '',
                        state: '',  // Add state if available in order
                        postalCode: '',  // Add postal code if available in order
                        country: 'LK',
                        phone: order.customerPhone,
                    },
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: city || order.customerCity || '',
                        state: '',  // Add state if available in order
                        postalCode: '',  // Add postal code if available in order
                        country: 'LK',
                        phone: order.customerPhone,
                    },
                    {
                        weight: parseFloat(weight),
                        length: 1,  // Default values, update if you have actual dimensions
                        width: 1,
                        height: 1,
                        description: `${order.product.name} x${order.quantity}`,
                    },
                    formattedOrderId,  // Using order ID as service reference
                    codAmount  // Pass the calculated COD amount
                );

                setTrackingNumber(result.trackingNumber);

                const response = await fetch(`/api/orders/${orderId}/shipping`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        shippingProvider: provider,
                        trackingNumber: result.trackingNumber,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update shipping information');
                }
            } else if (provider === ShippingProvider.TRANS_EXPRESS) {
                try {
                    console.log('Creating Trans Express shipment...');
                    if (!transExpressApiKey) {
                        throw new Error('Trans Express API key not provided.');
                    }
                    const transExpressService = new TransExpressProvider(transExpressApiKey);

                    // Generate a unique order number
                    const orderNo = parseInt(`${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`);
                    console.log('Trans Express order number:', orderNo);
                    console.log('Selected city ID:', selectedCity);

                    console.log('Trans Express provider created, sending shipment request...');
                    const result = await transExpressService.createShipment(
                        // Origin address (not directly used by Trans Express API but needed for our interface)
                        {
                            name: 'JNEX Warehouse',
                            street: '123 Warehouse St',
                            city: 'Colombo',
                            state: 'Western',
                            postalCode: '10300',
                            country: 'LK',
                            phone: '+9477123456',
                        },
                        // Destination address
                        {
                            name: order.customerName,
                            street: order.customerAddress,
                            city: order.customerCity || 'Colombo',
                            state: '',
                            postalCode: '',
                            country: 'LK',
                            phone: order.customerPhone,
                        },
                        // Package details
                        {
                            weight: parseFloat(weight),
                            length: 10,
                            width: 10,
                            height: 10,
                        },
                        // Service type - note this is not directly used by Trans Express API
                        'Standard',
                        // Pass the selected city ID
                        selectedCity,
                        // Pass the district ID if available (optional)
                        undefined,
                        // Pass the order total (price × quantity - discount)
                        (order.product.price * order.quantity) - (order.discount || 0)
                    );

                    console.log('Trans Express shipment created:', result);

                    setTrackingNumber(result.trackingNumber);

                    const response = await fetch(`/api/orders/${orderId}/shipping`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            shippingProvider: provider,
                            trackingNumber: result.trackingNumber,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update shipping information');
                    }
                } catch (err) {
                    console.error('Trans Express error:', err);
                    if (err instanceof TypeError && err.message.includes('fetch')) {
                        throw new Error('Unable to connect to Trans Express API. Check network connection and API URL.');
                    }
                    throw err;
                }
            } else if (provider === ShippingProvider.ROYAL_EXPRESS) {
                try {
                    console.log('Creating Royal Express (Curfox) shipment...');
                    if (!royalExpressApiKey) {
                        throw new Error('Royal Express API key not provided.');
                    }
                    const royalExpressService = new RoyalExpressProvider(royalExpressApiKey);

                    // Calculate the COD amount
                    const codAmount = (order.product.price * order.quantity) - (order.discount || 0);

                    console.log('Royal Express provider created, sending shipment request...');

                    // First verify we can connect to the API
                    try {
                        const userInfo = await royalExpressService.getUserInfo();
                        console.log('Curfox user info retrieved:', userInfo);
                    } catch (authError) {
                        console.error('Failed to authenticate with Curfox API:', authError);
                        throw new Error('Failed to authenticate with Curfox API. Please check your credentials.');
                    }

                    // Log valid state names for debugging
                    try {
                        const validStateNames = await royalExpressService.getStates();
                        console.log('Valid Royal Express states for this account:', validStateNames.data.map((s: any) => s.name));
                    } catch (stateError) {
                        console.error('Failed to fetch valid state names:', stateError);
                    }

                    // Use "Colombo" for origin state instead of "Colombo Suburbs"
                    const originState = "Colombo";
                    const destinationState = selectedState;

                    console.log(`Using origin state: "${originState}" and destination state: "${destinationState}"`);

                    const result = await royalExpressService.createShipment(
                        // Origin address
                        {
                            name: 'JNEX Warehouse',
                            street: '123 Warehouse St',
                            city: 'Kotte', // This should match the rate card
                            state: originState, // Using "Colombo" from valid state list
                            postalCode: '10300',
                            country: 'LK',
                            phone: '+9477123456',
                        },
                        // Destination address
                        {
                            name: order.customerName,
                            street: order.customerAddress,
                            city: citiesInState.find(c => c.id === selectedRoyalCity)?.name || 'Colombo 02',
                            state: destinationState,
                            postalCode: '',
                            country: 'LK',
                            phone: order.customerPhone,
                            alternatePhone: order.customerSecondPhone || '',
                        },
                        // Package details
                        {
                            weight: parseFloat(weight),
                            length: 10,
                            width: 10,
                            height: 10,
                        },
                        // Service type
                        'Standard',
                        // City ID
                        selectedRoyalCity,
                        // State ID
                        states.find(s => s.name === selectedState)?.id,
                        // COD amount
                        codAmount,
                        // Order prefix
                        royalExpressOrderPrefix
                    );

                    console.log('Royal Express (Curfox) shipment created:', result);

                    setTrackingNumber(result.trackingNumber);

                    const response = await fetch(`/api/orders/${orderId}/shipping`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            shippingProvider: provider,
                            trackingNumber: result.trackingNumber,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update shipping information');
                    }
                } catch (err) {
                    console.error('Royal Express (Curfox) error:', err);
                    if (err instanceof TypeError && err.message.includes('fetch')) {
                        throw new Error('Unable to connect to Curfox API. Check network connection and API URL.');
                    } else if (err instanceof Error && err.message.includes('authenticate')) {
                        throw new Error('Authentication with Curfox failed. Please check your email and password.');
                    }
                    throw err;
                }
            } else {
                const response = await fetch(`/api/orders/${orderId}/shipping`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        shippingProvider: provider,
                        trackingNumber,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update shipping information');
                }
            }

            // Call onSuccess callback if provided (for modal usage)
            if (onSuccess) {
                onSuccess();
            } else {
                // Check if we should redirect back to leads page
                const returnTo = searchParams.get('returnTo');
                if (returnTo === 'leads') {
                    router.push('/leads');
                } else {
                    router.refresh();
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const getTrackingUrl = () => {
        switch (provider) {
            case ShippingProvider.FARDA_EXPRESS:
                return `https://www.fdedomestic.com/track/${trackingNumber}`;
            case ShippingProvider.TRANS_EXPRESS:
                return `https://portal.transexpress.lk/tracking/${trackingNumber}`;
            case ShippingProvider.SL_POST:
                return `http://www.slpost.gov.lk/track-trace/${trackingNumber}`;
            case ShippingProvider.ROYAL_EXPRESS:
                return `https://merchant.curfox.com/tracking/${trackingNumber}`;
            default:
                return null;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="provider" className="block text-sm font-medium text-gray-400">
                    Shipping Provider
                </label>
                <select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                >
                    <option key="empty" value="">Select a provider</option>
                    <option key="farda" value={ShippingProvider.FARDA_EXPRESS}>Farda Express</option>
                    <option key="trans" value={ShippingProvider.TRANS_EXPRESS}>Trans Express</option>
                    <option key="royal" value={ShippingProvider.ROYAL_EXPRESS}>Royal Express</option>
                    <option key="slpost" value={ShippingProvider.SL_POST}>SL Post</option>
                </select>
            </div>

            {(provider === ShippingProvider.FARDA_EXPRESS || provider === ShippingProvider.TRANS_EXPRESS || provider === ShippingProvider.ROYAL_EXPRESS) && (
                <>
                    <div>
                        <label htmlFor="weight" className="block text-sm font-medium text-gray-400">
                            Parcel Weight (kg)
                        </label>
                        <input
                            type="number"
                            id="weight"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required
                            min="0.1"
                            step="0.1"
                        />
                    </div>

                    {provider === ShippingProvider.FARDA_EXPRESS && (
                        <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-400">
                                Recipient City
                            </label>
                            <input
                                type="text"
                                id="city"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                required
                            />
                        </div>
                    )}

                    {provider === ShippingProvider.TRANS_EXPRESS && (
                        <>
                            <div style={{ position: 'relative', zIndex: 50 }}>
                                <label htmlFor="district" className="block text-sm font-medium text-gray-400">
                                    District
                                </label>
                                <select
                                    id="district"
                                    value={selectedDistrict}
                                    onChange={(e) => setSelectedDistrict(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    required
                                    disabled={isLoadingLocations}
                                    style={{ zIndex: 50 }}
                                >
                                    {/* Always show at least Colombo as fallback */}
                                    {(districts.length === 0 || !districts.includes('Colombo')) && (
                                        <option key="default-colombo" value="Colombo">Colombo</option>
                                    )}
                                    {/* Show Gampaha as fallback option if not in districts list */}
                                    {(districts.length === 0 || !districts.includes('Gampaha')) && (
                                        <option key="default-gampaha" value="Gampaha">Gampaha</option>
                                    )}
                                    {/* Show Kandy as fallback option if not in districts list */}
                                    {(districts.length === 0 || !districts.includes('Kandy')) && (
                                        <option key="default-kandy" value="Kandy">Kandy</option>
                                    )}
                                    {/* Map loaded districts */}
                                    {districts.map((district) => (
                                        <option key={district} value={district}>
                                            {district}
                                        </option>
                                    ))}
                                </select>
                                {isLoadingLocations && <div className="text-xs text-gray-400 mt-1">Loading districts...</div>}
                            </div>

                            <div style={{ position: 'relative', zIndex: 40 }}>
                                <label htmlFor="city_id" className="block text-sm font-medium text-gray-400">
                                    City
                                </label>
                                <div className="relative city-dropdown-container">
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            id="city_id"
                                            value={citySearchTerm}
                                            onChange={(e) => {
                                                setCitySearchTerm(e.target.value);
                                                setShowCityDropdown(true);
                                            }}
                                            onClick={() => setShowCityDropdown(true)}
                                            onFocus={() => setShowCityDropdown(true)}
                                            placeholder={isLoadingLocations ? "Loading cities..." : "Search for a city..."}
                                            className="mt-1 block w-full pl-10 pr-10 rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            required
                                            disabled={isLoadingLocations}
                                        />
                                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400">
                                            {isLoadingLocations ? (
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3z" clipRule="evenodd" />
                                                    <path fillRule="evenodd" d="M10 17a.75.75 0 01-.55-.24l-3.25-3.5a.75.75 0 111.1-1.02L10 15.148l2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5A.75.75 0 0110 17z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                    {showCityDropdown && !isLoadingLocations && (
                                        <div className="absolute z-50 mt-1 w-full bg-gray-800 rounded-md ring-1 ring-white/10 max-h-60 overflow-y-auto border border-gray-700">
                                            {filteredCities.length > 0 ? filteredCities.map((city) => (
                                                <button
                                                    key={city.id}
                                                    onClick={() => {
                                                        setSelectedCity(city.id);
                                                        setCitySearchTerm(city.name);
                                                        setShowCityDropdown(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-100 hover:bg-gray-700"
                                                >
                                                    {city.name}
                                                </button>
                                            )) : (
                                                <div className="px-4 py-2 text-sm text-gray-400">
                                                    No cities match your search
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Display the selected city name below the dropdown */}
                                {selectedCity && citiesInDistrict.length > 0 && !showCityDropdown && (
                                    <div className="mt-1 text-xs text-gray-400">
                                        Selected: {citiesInDistrict.find(c => c.id === selectedCity)?.name || "Unknown City"}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {provider === ShippingProvider.ROYAL_EXPRESS && (
                        <>
                            <div style={{ position: 'relative', zIndex: 50 }}>
                                <label htmlFor="royalState" className="block text-sm font-medium text-gray-400">
                                    State
                                </label>
                                <select
                                    id="royalState"
                                    value={selectedState}
                                    onChange={(e) => setSelectedState(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    required
                                    disabled={isLoadingRoyalLocations}
                                    style={{ zIndex: 50 }}
                                >
                                    {/* Fallback states if none loaded */}
                                    {(states.length === 0 || !states.some(s => s.name === 'Colombo')) && (
                                        <option key="default-colombo" value="Colombo">Colombo</option>
                                    )}
                                    {(states.length === 0 || !states.some(s => s.name === 'Kandy')) && (
                                        <option key="default-kandy" value="Kandy">Kandy</option>
                                    )}
                                    {(states.length === 0 || !states.some(s => s.name === 'Colombo Suburbs')) && (
                                        <option key="default-colombo-suburbs" value="Colombo Suburbs">Colombo Suburbs</option>
                                    )}
                                    {/* Map loaded states */}
                                    {states.map((state) => (
                                        <option key={state.id} value={state.name}>
                                            {state.name}
                                        </option>
                                    ))}
                                </select>
                                {isLoadingRoyalLocations && <div className="text-xs text-gray-400 mt-1">Loading states...</div>}
                            </div>

                            <div style={{ position: 'relative', zIndex: 30 }}>
                                <label htmlFor="royalCity" className="block text-sm font-medium text-gray-400">
                                    City
                                </label>
                                <div className="relative royal-city-dropdown-container">
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="flex">
                                            <input
                                                type="text"
                                                id="royalCity"
                                                value={royalCitySearchTerm}
                                                onChange={(e) => {
                                                    setRoyalCitySearchTerm(e.target.value);
                                                    setShowRoyalCityDropdown(true);
                                                }}
                                                onClick={() => setShowRoyalCityDropdown(true)}
                                                onFocus={() => setShowRoyalCityDropdown(true)}
                                                placeholder={isLoadingRoyalLocations ? "Loading cities..." : "Search for a city..."}
                                                className="mt-1 block w-full pl-10 pr-10 rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                required
                                                disabled={isLoadingRoyalLocations}
                                            />
                                            <button
                                                type="button"
                                                className="ml-2 mt-1 inline-flex items-center rounded border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-400 ring-1 ring-white/10 hover:bg-gray-700"
                                                onClick={() => {
                                                    if (selectedState) {
                                                        // Force refresh cities for the selected state
                                                        const updateRoyalCities = async () => {
                                                            setIsLoadingRoyalLocations(true);
                                                            try {
                                                                const response = await fetch(`/api/shipping/royal-express/locations?state=${encodeURIComponent(selectedState)}`);
                                                                if (!response.ok) {
                                                                    throw new Error(`Failed to fetch cities for state ${selectedState}`);
                                                                }

                                                                const data = await response.json();
                                                                const cities = data.cities || [];

                                                                console.log('Royal Express cities reloaded:', cities);
                                                                setCitiesInState(cities);

                                                                if (cities.length > 0) {
                                                                    setSelectedRoyalCity(cities[0].id);
                                                                    setRoyalCitySearchTerm(cities[0].name);
                                                                }
                                                            } catch (err) {
                                                                console.error(`Failed to reload cities for state ${selectedState}:`, err);
                                                            } finally {
                                                                setIsLoadingRoyalLocations(false);
                                                            }
                                                        };

                                                        updateRoyalCities();
                                                    }
                                                }}
                                                disabled={isLoadingRoyalLocations}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                            <svg className={`h-4 w-4 transition-transform ${showRoyalCityDropdown ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        {isLoadingRoyalLocations && (
                                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                                <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    {showRoyalCityDropdown && !isLoadingRoyalLocations && (
                                        <div className="absolute z-50 mt-1 w-full bg-gray-800 rounded-md ring-1 ring-white/10 max-h-60 overflow-y-auto border border-gray-700">
                                            {filteredRoyalCities.length > 0 ? filteredRoyalCities.map((city) => (
                                                <button
                                                    key={city.id}
                                                    onClick={() => {
                                                        setSelectedRoyalCity(city.id);
                                                        setRoyalCitySearchTerm(city.name);
                                                        setShowRoyalCityDropdown(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-100 hover:bg-gray-700"
                                                >
                                                    {city.name}
                                                </button>
                                            )) : (
                                                <div className="px-4 py-2 text-sm text-gray-400">
                                                    No cities match your search in {selectedState}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {/* Display the selected city name below the dropdown */}
                                {selectedRoyalCity && citiesInState.length > 0 && !showRoyalCityDropdown && (
                                    <div className="mt-1 text-xs text-gray-400">
                                        Selected: {citiesInState.find(c => c.id === selectedRoyalCity)?.name || "Unknown City"}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            {provider !== ShippingProvider.FARDA_EXPRESS && provider !== ShippingProvider.TRANS_EXPRESS && provider !== ShippingProvider.ROYAL_EXPRESS && (
                <div>
                    <label htmlFor="tracking" className="block text-sm font-medium text-gray-400">
                        Tracking Number
                    </label>
                    <input
                        type="text"
                        id="tracking"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-gray-100 ring-1 ring-white/10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                    />
                </div>
            )}

            {error && (
                <div className="rounded-lg bg-red-900/50 p-4 text-sm text-red-400 ring-1 ring-red-500">
                    {error}
                </div>
            )}

            <div className="flex justify-between items-center">
                <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : (
                        'Save Shipping Info'
                    )}
                </motion.button>

                {trackingNumber && provider && getTrackingUrl() && (
                    <motion.a
                        href={getTrackingUrl()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        Track on Carrier Site →
                    </motion.a>
                )}
            </div>
        </form>
    );
}