'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TruckIcon,
    ScaleIcon,
    MapPinIcon,
    BuildingOfficeIcon,
    ArrowTopRightOnSquareIcon,
    CheckCircleIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { FardaExpressService } from '@/lib/shipping/farda-express';
import { TransExpressProvider } from '@/lib/shipping/trans-express';

import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { RoyalExpressCity, RoyalExpressState } from '@/lib/shipping/royal-express-locations';
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
    transExpressOrderPrefix?: string;
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
    transExpressOrderPrefix,
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

    // For Trans Express - city name input with autocomplete
    const [transExpressCityName, setTransExpressCityName] = useState(order.customerCity || '');
    const [allTransExpressCities, setAllTransExpressCities] = useState<{ id: number; text: string; district_name?: string }[]>([]);
    const [filteredTransExpressCities, setFilteredTransExpressCities] = useState<{ id: number; text: string; district_name?: string }[]>([]);
    const [showTransExpressCityDropdown, setShowTransExpressCityDropdown] = useState(false);
    const [isLoadingTransExpressCities, setIsLoadingTransExpressCities] = useState(false);

    // For Royal Express
    const [states, setStates] = useState<RoyalExpressState[]>([]);
    const [selectedState, setSelectedState] = useState<string>('Colombo');
    const [selectedRoyalCity, setSelectedRoyalCity] = useState<number>(1001);
    const [allRoyalCities, setAllRoyalCities] = useState<RoyalExpressCity[]>([]);
    const [isLoadingRoyalLocations, setIsLoadingRoyalLocations] = useState(false);
    const [royalCitySearchTerm, setRoyalCitySearchTerm] = useState('');
    const [filteredRoyalCities, setFilteredRoyalCities] = useState<RoyalExpressCity[]>([]);
    const [showRoyalCityDropdown, setShowRoyalCityDropdown] = useState(false);



    // Load all cities when provider changes to Trans Express
    useEffect(() => {
        const loadTransExpressCities = async () => {
            if (provider !== 'TRANS_EXPRESS') return;

            setIsLoadingTransExpressCities(true);
            try {
                const response = await fetch('/api/shipping/locations');
                if (!response.ok) throw new Error('Failed to fetch locations');
                const data = await response.json();

                if (data.cities && data.cities.length > 0) {
                    // Enrich cities with district names
                    const districtMap = new Map<number, string>();
                    if (data.districts) {
                        data.districts.forEach((d: { id: number; text: string }) => {
                            districtMap.set(d.id, d.text);
                        });
                    }
                    const enrichedCities = data.cities.map((c: { id: number; text: string; district_id?: number }) => ({
                        id: c.id,
                        text: c.text,
                        district_name: c.district_id ? districtMap.get(c.district_id) || '' : ''
                    }));
                    setAllTransExpressCities(enrichedCities);
                    setFilteredTransExpressCities(enrichedCities);
                }
            } catch (err) {
                console.error('Failed to load Trans Express cities:', err);
                // Use fallback from trans-express-cities
                const fallbackCities = [
                    { id: 864, text: 'Colombo 01', district_name: 'Colombo' },
                    { id: 879, text: 'Dehiwala', district_name: 'Colombo' },
                    { id: 882, text: 'Moratuwa', district_name: 'Colombo' },
                    { id: 884, text: 'Maharagama', district_name: 'Colombo' },
                    { id: 885, text: 'Nugegoda', district_name: 'Colombo' },
                    { id: 901, text: 'Kandy', district_name: 'Kandy' },
                    { id: 920, text: 'Galle', district_name: 'Galle' },
                    { id: 950, text: 'Negombo', district_name: 'Gampaha' },
                    { id: 990, text: 'Kurunegala', district_name: 'Kurunegala' },
                ];
                setAllTransExpressCities(fallbackCities);
                setFilteredTransExpressCities(fallbackCities);
            } finally {
                setIsLoadingTransExpressCities(false);
            }
        };
        loadTransExpressCities();
    }, [provider]);

    // Load all cities when provider changes to Royal Express
    useEffect(() => {
        const loadRoyalExpressData = async () => {
            if (provider !== 'ROYAL_EXPRESS') return;

            setIsLoadingRoyalLocations(true);
            try {
                // Fetch from API route instead of calling the library directly
                const response = await fetch('/api/shipping/royal-express/locations');

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch locations');
                }

                const data = await response.json();
                console.log('Royal Express locations data:', data);
                const { states: allStates, cities } = data;

                if (allStates && allStates.length > 0) {
                    setStates(allStates);
                }

                if (cities && cities.length > 0) {
                    console.log(`Loaded ${cities.length} cities for Royal Express`);
                    setAllRoyalCities(cities);
                    setFilteredRoyalCities(cities);

                    // Set default selection
                    const defaultCity = cities.find((c: RoyalExpressCity) => c.name === 'Colombo 01') || cities[0];
                    setSelectedRoyalCity(defaultCity.id);
                    setSelectedState(defaultCity.state);
                    setRoyalCitySearchTerm(defaultCity.name);
                } else {
                    console.warn('No cities in API response, using client fallback');
                    throw new Error('No cities returned from API');
                }
            } catch (err) {
                console.error('Failed to load Royal Express locations:', err);
                // Fallback data - comprehensive list
                const fallbackStates = [
                    { id: 1, name: 'Colombo' },
                    { id: 2, name: 'Kandy' },
                    { id: 3, name: 'Galle' },
                    { id: 4, name: 'Gampaha' }
                ];
                const fallbackCities = [
                    { id: 1001, name: 'Colombo 01', state: 'Colombo' },
                    { id: 1002, name: 'Colombo 02', state: 'Colombo' },
                    { id: 1003, name: 'Colombo 03', state: 'Colombo' },
                    { id: 1004, name: 'Colombo 04', state: 'Colombo' },
                    { id: 1005, name: 'Colombo 05', state: 'Colombo' },
                    { id: 1006, name: 'Colombo 06', state: 'Colombo' },
                    { id: 1007, name: 'Colombo 07', state: 'Colombo' },
                    { id: 1016, name: 'Dehiwala', state: 'Colombo' },
                    { id: 1017, name: 'Mount Lavinia', state: 'Colombo' },
                    { id: 1019, name: 'Moratuwa', state: 'Colombo' },
                    { id: 1021, name: 'Maharagama', state: 'Colombo' },
                    { id: 1022, name: 'Nugegoda', state: 'Colombo' },
                    { id: 1023, name: 'Battaramulla', state: 'Colombo' },
                    { id: 2001, name: 'Kandy', state: 'Kandy' },
                    { id: 3001, name: 'Galle', state: 'Galle' },
                    { id: 4001, name: 'Gampaha', state: 'Gampaha' },
                    { id: 4002, name: 'Negombo', state: 'Gampaha' },
                    { id: 4003, name: 'Ja-Ela', state: 'Gampaha' },
                    { id: 4004, name: 'Kadawatha', state: 'Gampaha' },
                    { id: 4005, name: 'Kiribathgoda', state: 'Gampaha' },
                    { id: 4006, name: 'Wattala', state: 'Gampaha' },
                ];
                setStates(fallbackStates);
                setAllRoyalCities(fallbackCities);
                setFilteredRoyalCities(fallbackCities);
                setSelectedState('Colombo');
                setRoyalCitySearchTerm('Colombo 01');
            } finally {
                setIsLoadingRoyalLocations(false);
            }
        };
        loadRoyalExpressData();
    }, [provider]);

    // Filter cities based on search term for Royal Express (searches all cities)
    useEffect(() => {
        if (royalCitySearchTerm.trim() === '') {
            setFilteredRoyalCities(allRoyalCities);
        } else {
            const searchLower = royalCitySearchTerm.toLowerCase();
            const filtered = allRoyalCities.filter(city =>
                city.name.toLowerCase().includes(searchLower) ||
                city.state.toLowerCase().includes(searchLower)
            );
            setFilteredRoyalCities(filtered);
        }
    }, [royalCitySearchTerm, allRoyalCities]);

    // Filter cities based on search term for Trans Express
    useEffect(() => {
        if (transExpressCityName.trim() === '') {
            setFilteredTransExpressCities(allTransExpressCities);
        } else {
            const searchLower = transExpressCityName.toLowerCase();
            const filtered = allTransExpressCities.filter(city =>
                city.text.toLowerCase().includes(searchLower) ||
                (city.district_name && city.district_name.toLowerCase().includes(searchLower))
            );
            setFilteredTransExpressCities(filtered);
        }
    }, [transExpressCityName, allTransExpressCities]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.trans-express-city-dropdown-container')) {
                setShowTransExpressCityDropdown(false);
            }
            if (!target.closest('.royal-city-dropdown-container')) {
                setShowRoyalCityDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
                const codAmount = (order.product.price * order.quantity) - (order.discount || 0);

                const result = await fardaService.createShipment(
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: city || order.customerCity || '',
                        state: '',
                        postalCode: '',
                        country: 'LK',
                        phone: order.customerPhone,
                    },
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: city || order.customerCity || '',
                        state: '',
                        postalCode: '',
                        country: 'LK',
                        phone: order.customerPhone,
                    },
                    {
                        weight: parseFloat(weight),
                        length: 1,
                        width: 1,
                        height: 1,
                        description: `${order.product.name} x${order.quantity}`,
                    },
                    formattedOrderId,
                    codAmount
                );

                setTrackingNumber(result.trackingNumber);
                await updateShippingInfo(provider, result.trackingNumber);

            } else if (provider === ShippingProvider.TRANS_EXPRESS) {
                if (!transExpressApiKey) {
                    throw new Error('Trans Express API key not provided.');
                }
                const transExpressService = new TransExpressProvider(transExpressApiKey);
                const codAmount = (order.product.price * order.quantity) - (order.discount || 0);
                const cityNameToUse = transExpressCityName || order.customerCity || 'Colombo';

                const result = await transExpressService.createShipmentByCityName(
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: cityNameToUse,
                        state: '',
                        postalCode: '',
                        country: 'LK',
                        phone: order.customerPhone,
                    },
                    {
                        weight: parseFloat(weight),
                        length: 10,
                        width: 10,
                        height: 10,
                    },
                    'Standard',
                    cityNameToUse,
                    codAmount,
                    tenantId,
                    orderId,
                    transExpressOrderPrefix
                );

                setTrackingNumber(result.trackingNumber);
                await updateShippingInfo(provider, result.trackingNumber);

            } else if (provider === ShippingProvider.ROYAL_EXPRESS) {
                if (!royalExpressApiKey) {
                    throw new Error('Royal Express API key not provided.');
                }
                const royalExpressService = new RoyalExpressProvider(royalExpressApiKey);
                const codAmount = (order.product.price * order.quantity) - (order.discount || 0);
                const originState = "Colombo";
                // Get the state from the selected city
                const selectedCityData = allRoyalCities.find(c => c.id === selectedRoyalCity);
                const destinationState = selectedCityData?.state || selectedState;

                const result = await royalExpressService.createShipment(
                    {
                        name: 'JNEX Warehouse',
                        street: '123 Warehouse St',
                        city: 'Kotte',
                        state: originState,
                        postalCode: '10300',
                        country: 'LK',
                        phone: '+9477123456',
                    },
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: selectedCityData?.name || 'Colombo 02',
                        state: destinationState,
                        postalCode: '',
                        country: 'LK',
                        phone: order.customerPhone,
                        alternatePhone: order.customerSecondPhone || '',
                    },
                    {
                        weight: parseFloat(weight),
                        length: 10,
                        width: 10,
                        height: 10,
                    },
                    'Standard',
                    selectedRoyalCity,
                    states.find(s => s.name === destinationState)?.id,
                    codAmount,
                    royalExpressOrderPrefix
                );

                setTrackingNumber(result.trackingNumber);
                await updateShippingInfo(provider, result.trackingNumber);

            } else {
                await updateShippingInfo(provider, trackingNumber);
            }

            if (onSuccess) {
                onSuccess();
            } else {
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

    const updateShippingInfo = async (provider: string, trackingNumber: string) => {
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

    // Manage overflow state for dropdown visibility
    const [isAnimating, setIsAnimating] = useState(false);

    const providers = [
        { id: ShippingProvider.FARDA_EXPRESS, name: 'Farda Express', logo: 'FE' },
        { id: ShippingProvider.TRANS_EXPRESS, name: 'Trans Express', logo: 'TE' },
        { id: ShippingProvider.ROYAL_EXPRESS, name: 'Royal Express', logo: 'RE' },
        { id: ShippingProvider.SL_POST, name: 'SL Post', logo: 'SL' },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Provider Selection */}
            <div>
                <label className="block text-sm font-medium text-muted-foreground mb-3">
                    Select Shipping Provider
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {providers.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => setProvider(p.id)}
                            className={`
                                cursor-pointer rounded-xl border p-4 flex items-center gap-3 transition-all
                                ${provider === p.id
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border bg-card hover:bg-muted/50 hover:border-primary/50'
                                }
                            `}
                        >
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                                ${provider === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                            `}>
                                {p.logo}
                            </div>
                            <span className={`font-medium ${provider === p.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {p.name}
                            </span>
                            {provider === p.id && (
                                <CheckCircleIcon className="w-5 h-5 text-primary ml-auto" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait" onExitComplete={() => setIsAnimating(false)}>
                {provider && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onAnimationStart={() => setIsAnimating(true)}
                        onAnimationComplete={() => setIsAnimating(false)}
                        className={`space-y-6 ${isAnimating ? 'overflow-hidden' : 'overflow-visible'}`}
                    >
                        {/* Common Fields */}
                        {(provider === ShippingProvider.FARDA_EXPRESS || provider === ShippingProvider.TRANS_EXPRESS || provider === ShippingProvider.ROYAL_EXPRESS) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="weight" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        Parcel Weight (kg)
                                    </label>
                                    <div className="relative">
                                        <ScaleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="number"
                                            id="weight"
                                            value={weight}
                                            onChange={(e) => setWeight(e.target.value)}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                            required
                                            min="0.1"
                                            step="0.1"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Farda Express Specific */}
                        {provider === ShippingProvider.FARDA_EXPRESS && (
                            <div>
                                <label htmlFor="city" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                    Recipient City
                                </label>
                                <div className="relative">
                                    <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        id="city"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Trans Express Specific - City search with autocomplete */}
                        {provider === ShippingProvider.TRANS_EXPRESS && (
                            <div>
                                <div className="relative trans-express-city-dropdown-container">
                                    <label htmlFor="transExpressCity" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        Recipient City
                                    </label>
                                    <div className="relative">
                                        <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            id="transExpressCity"
                                            value={transExpressCityName}
                                            onChange={(e) => {
                                                setTransExpressCityName(e.target.value);
                                                setShowTransExpressCityDropdown(true);
                                            }}
                                            onFocus={() => setShowTransExpressCityDropdown(true)}
                                            onClick={() => setShowTransExpressCityDropdown(true)}
                                            placeholder={isLoadingTransExpressCities ? "Loading cities..." : "Type to search city..."}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                            required
                                            disabled={isLoadingTransExpressCities}
                                            autoComplete="off"
                                        />
                                    </div>
                                    {showTransExpressCityDropdown && !isLoadingTransExpressCities && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover rounded-lg border border-border shadow-lg max-h-60 overflow-y-auto">
                                            {filteredTransExpressCities.length > 0 ? filteredTransExpressCities.slice(0, 50).map((city) => (
                                                <button
                                                    key={city.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setTransExpressCityName(city.text);
                                                        setShowTransExpressCityDropdown(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    <span>{city.text}</span>
                                                    {city.district_name && (
                                                        <span className="text-muted-foreground ml-2">({city.district_name})</span>
                                                    )}
                                                </button>
                                            )) : (
                                                <div className="px-4 py-2 text-sm text-muted-foreground">No cities found</div>
                                            )}
                                            {filteredTransExpressCities.length > 50 && (
                                                <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                                                    Type more to narrow down results...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPinIcon className="w-3 h-3" />
                                    District will be auto-detected from the city name
                                </p>
                            </div>
                        )}

                        {/* Royal Express Specific - Single city search */}
                        {provider === ShippingProvider.ROYAL_EXPRESS && (
                            <div>
                                <div className="relative royal-city-dropdown-container">
                                    <label htmlFor="royalCity" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        Destination City
                                    </label>
                                    <div className="relative">
                                        <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            id="royalCity"
                                            value={royalCitySearchTerm}
                                            onChange={(e) => {
                                                setRoyalCitySearchTerm(e.target.value);
                                                setShowRoyalCityDropdown(true);
                                            }}
                                            onFocus={() => setShowRoyalCityDropdown(true)}
                                            onClick={() => setShowRoyalCityDropdown(true)}
                                            placeholder={isLoadingRoyalLocations ? "Loading cities..." : "Type to search city..."}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                            required
                                            disabled={isLoadingRoyalLocations}
                                            autoComplete="off"
                                        />
                                    </div>
                                    {showRoyalCityDropdown && !isLoadingRoyalLocations && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover rounded-lg border border-border shadow-lg max-h-60 overflow-y-auto">
                                            {filteredRoyalCities.length > 0 ? filteredRoyalCities.slice(0, 50).map((city) => (
                                                <button
                                                    key={city.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRoyalCity(city.id);
                                                        setSelectedState(city.state);
                                                        setRoyalCitySearchTerm(city.name);
                                                        setShowRoyalCityDropdown(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    <span>{city.name}</span>
                                                    <span className="text-muted-foreground ml-2">({city.state})</span>
                                                </button>
                                            )) : (
                                                <div className="px-4 py-2 text-sm text-muted-foreground">No cities found</div>
                                            )}
                                            {filteredRoyalCities.length > 50 && (
                                                <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                                                    Type more to narrow down results...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {selectedState && royalCitySearchTerm && (
                                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPinIcon className="w-3 h-3" />
                                        State: {selectedState}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Manual Tracking Number Input */}
                        {!['FARDA_EXPRESS', 'TRANS_EXPRESS', 'ROYAL_EXPRESS'].includes(provider) && (
                            <div>
                                <label htmlFor="tracking" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                    Tracking Number
                                </label>
                                <div className="relative">
                                    <TruckIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        id="tracking"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                        className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                        required
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2"
                >
                    <ExclamationCircleIcon className="w-5 h-5" />
                    {error}
                </motion.div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <motion.button
                    type="submit"
                    disabled={isLoading || !provider}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex-1 inline-flex justify-center items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : (
                        'Save Shipping Info'
                    )}
                </motion.button>
            </div>
        </form>
    );
}