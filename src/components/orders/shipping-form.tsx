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
import { getAllDistricts, getCitiesByDistrict, TransExpressCity } from '@/lib/shipping/trans-express-cities';
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
    const [selectedDistrict, setSelectedDistrict] = useState<string>('Colombo');
    const [selectedCity, setSelectedCity] = useState<number>(864);
    const [citiesInDistrict, setCitiesInDistrict] = useState<TransExpressCity[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [citySearchTerm, setCitySearchTerm] = useState('');
    const [filteredCities, setFilteredCities] = useState<TransExpressCity[]>([]);
    const [showCityDropdown, setShowCityDropdown] = useState(false);

    // For Royal Express
    const [states, setStates] = useState<RoyalExpressState[]>([]);
    const [selectedState, setSelectedState] = useState<string>('Colombo');
    const [selectedRoyalCity, setSelectedRoyalCity] = useState<number>(1001);
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
                const allDistricts = await getAllDistricts();
                setDistricts(allDistricts);
                setSelectedDistrict('Colombo');
            } catch (err) {
                console.error('Failed to load districts:', err);
                setDistricts(['Colombo', 'Gampaha', 'Kandy']);
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
                if (!royalExpressApiKey) {
                    setIsLoadingRoyalLocations(false);
                    return;
                }
                const royalExpressService = new RoyalExpressProvider(royalExpressApiKey);
                const allStates = await getAllStates(royalExpressService);
                setStates(allStates);
                setSelectedState('Colombo');
            } catch (err) {
                console.error('Failed to load Royal Express states:', err);
                setStates([
                    { id: 1, name: 'Colombo' },
                    { id: 3, name: 'Galle' },
                    { id: 4, name: 'Gampaha' }
                ]);
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
                const cities = await getCitiesByDistrict(selectedDistrict);
                setCitiesInDistrict(cities);

                if (cities.length > 0) {
                    setSelectedCity(cities[0].id);
                    setCitySearchTerm(cities[0].name);
                } else {
                    const fallbackCities = await getCitiesByDistrict('Colombo');
                    if (fallbackCities.length > 0) {
                        setCitiesInDistrict([{ id: fallbackCities[0].id, name: fallbackCities[0].name, district: selectedDistrict }]);
                        setSelectedCity(fallbackCities[0].id);
                        setCitySearchTerm(fallbackCities[0].name);
                    }
                }
            } catch (err) {
                console.error('Failed to load cities for district:', err);
                setCitiesInDistrict([{ id: 864, name: 'Colombo 01', district: selectedDistrict }]);
                setSelectedCity(864);
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
                    setIsLoadingRoyalLocations(false);
                    return;
                }
                const royalExpressService = new RoyalExpressProvider(royalExpressApiKey);
                const cities = await getCitiesByState(royalExpressService, selectedState);
                setCitiesInState(cities);

                if (cities.length > 0) {
                    setSelectedRoyalCity(cities[0].id);
                    setRoyalCitySearchTerm(cities[0].name);
                } else {
                    setCitiesInState([{ id: 1001, name: 'Colombo 01', state: selectedState }]);
                    setSelectedRoyalCity(1001);
                    setRoyalCitySearchTerm('Colombo 01');
                }
            } catch (err) {
                console.error(`Failed to load cities for state ${selectedState}:`, err);
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
            if (!target.closest('.city-dropdown-container')) {
                setShowCityDropdown(false);
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

    // Clear city search term when state changes
    useEffect(() => {
        if (provider === 'ROYAL_EXPRESS' && selectedState) {
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
                const result = await transExpressService.createShipment(
                    {
                        name: 'JNEX Warehouse',
                        street: '123 Warehouse St',
                        city: 'Colombo',
                        state: 'Western',
                        postalCode: '10300',
                        country: 'LK',
                        phone: '+9477123456',
                    },
                    {
                        name: order.customerName,
                        street: order.customerAddress,
                        city: order.customerCity || 'Colombo',
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
                    selectedCity,
                    undefined,
                    (order.product.price * order.quantity) - (order.discount || 0)
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
                const destinationState = selectedState;

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
                        city: citiesInState.find(c => c.id === selectedRoyalCity)?.name || 'Colombo 02',
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
                    states.find(s => s.name === selectedState)?.id,
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

                        {/* Trans Express Specific */}
                        {provider === ShippingProvider.TRANS_EXPRESS && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="district" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        District
                                    </label>
                                    <div className="relative">
                                        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <select
                                            id="district"
                                            value={selectedDistrict}
                                            onChange={(e) => setSelectedDistrict(e.target.value)}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2 appearance-none"
                                            required
                                            disabled={isLoadingLocations}
                                        >
                                            {districts.map((district) => (
                                                <option key={district} value={district}>{district}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="relative city-dropdown-container">
                                    <label htmlFor="city_id" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        City
                                    </label>
                                    <div className="relative">
                                        <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            id="city_id"
                                            value={citySearchTerm}
                                            onChange={(e) => {
                                                setCitySearchTerm(e.target.value);
                                                setShowCityDropdown(true);
                                            }}
                                            onFocus={() => setShowCityDropdown(true)}
                                            onClick={() => setShowCityDropdown(true)}
                                            placeholder={isLoadingLocations ? "Loading..." : "Search city..."}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                            required
                                            disabled={isLoadingLocations}
                                            autoComplete="off"
                                        />
                                    </div>
                                    {showCityDropdown && !isLoadingLocations && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover rounded-lg border border-border shadow-lg max-h-60 overflow-y-auto">
                                            {filteredCities.length > 0 ? filteredCities.map((city) => (
                                                <button
                                                    key={city.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCity(city.id);
                                                        setCitySearchTerm(city.name);
                                                        setShowCityDropdown(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    {city.name}
                                                </button>
                                            )) : (
                                                <div className="px-4 py-2 text-sm text-muted-foreground">No cities found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Royal Express Specific */}
                        {provider === ShippingProvider.ROYAL_EXPRESS && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="royalState" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        State
                                    </label>
                                    <div className="relative">
                                        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <select
                                            id="royalState"
                                            value={selectedState}
                                            onChange={(e) => setSelectedState(e.target.value)}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2 appearance-none"
                                            required
                                            disabled={isLoadingRoyalLocations}
                                        >
                                            {states.map((state) => (
                                                <option key={state.id} value={state.name}>{state.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="relative royal-city-dropdown-container">
                                    <label htmlFor="royalCity" className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        City
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
                                            placeholder={isLoadingRoyalLocations ? "Loading..." : "Search city..."}
                                            className="block w-full pl-9 rounded-lg border-input bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-2"
                                            required
                                            disabled={isLoadingRoyalLocations}
                                            autoComplete="off"
                                        />
                                    </div>
                                    {showRoyalCityDropdown && !isLoadingRoyalLocations && (
                                        <div className="absolute z-50 mt-1 w-full bg-popover rounded-lg border border-border shadow-lg max-h-60 overflow-y-auto">
                                            {filteredRoyalCities.length > 0 ? filteredRoyalCities.map((city) => (
                                                <button
                                                    key={city.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRoyalCity(city.id);
                                                        setRoyalCitySearchTerm(city.name);
                                                        setShowRoyalCityDropdown(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    {city.name}
                                                </button>
                                            )) : (
                                                <div className="px-4 py-2 text-sm text-muted-foreground">No cities found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
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