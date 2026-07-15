'use client';

import { useEffect, useMemo, useState } from 'react';
import { BuildingOfficeIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface District {
  id: number;
  text: string;
}

interface City {
  id: number;
  text: string;
  district_id?: number;
}

export interface TransExpressLocationValue {
  provider: 'TRANS_EXPRESS';
  districtId: number;
  districtName: string;
  cityId: number;
  cityName: string;
}

export function TransExpressLocationPicker({
  value,
  onChange,
  suggestedCity,
  disabled = false,
}: {
  value?: TransExpressLocationValue;
  onChange: (value: TransExpressLocationValue | undefined) => void;
  suggestedCity?: string;
  disabled?: boolean;
}) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districtId, setDistrictId] = useState<number | ''>(value?.districtId || '');
  const [citySearch, setCitySearch] = useState(value?.cityName || suggestedCity || '');
  const [showCities, setShowCities] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch('/api/shipping/locations/districts');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load courier locations');
        if (cancelled) return;

        const loadedDistricts: District[] = data.districts || [];
        setDistricts(loadedDistricts);

        // Existing orders already know their district. Load that district's
        // cities directly so the saved selection remains editable.
        if (value?.districtId) {
          setLoadingCities(true);
          const cityResponse = await fetch(`/api/shipping/locations/cities?district_id=${value.districtId}`);
          const cityData = await cityResponse.json();
          if (!cityResponse.ok) throw new Error(cityData.error || 'Failed to load cities');
          if (!cancelled) setCities(cityData.cities || []);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load courier locations');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingCities(false);
        }
      }
    };

    loadLocations();
    return () => { cancelled = true; };
  // Locations are immutable for this picker session; selection changes must not
  // refetch the courier API and reset the operator's input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedCity]);

  const filteredCities = useMemo(() => {
    if (!districtId) return [];
    const query = citySearch.trim().toLowerCase();
    return cities
      .filter((city) => !query || city.text.toLowerCase().includes(query))
      .slice(0, 50);
  }, [cities, districtId, citySearch]);

  const selectDistrict = async (nextDistrictId: number | '') => {
    const firstSelection = districtId === '';
    setDistrictId(nextDistrictId);
    setCitySearch(firstSelection ? (suggestedCity || '') : '');
    setCities([]);
    setShowCities(false);
    setCityError(null);
    onChange(undefined);

    if (!nextDistrictId) return;
    setLoadingCities(true);
    try {
      const response = await fetch(`/api/shipping/locations/cities?district_id=${nextDistrictId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load cities');
      setCities(data.cities || []);
      setShowCities(true);
    } catch (error) {
      setCityError(error instanceof Error ? error.message : 'Failed to load cities');
    } finally {
      setLoadingCities(false);
    }
  };

  const selectCity = (city: City) => {
    const district = districts.find((item) => item.id === districtId);
    if (!district) return;
    setCitySearch(city.text);
    setShowCities(false);
    onChange({
      provider: 'TRANS_EXPRESS',
      districtId: district.id,
      districtName: district.text,
      cityId: city.id,
      cityName: city.text,
    });
  };

  return (
    <div className="sm:col-span-2 rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Trans Express delivery location</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This courier location will be saved with the order and reused for bulk shipping.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}. Refresh the page to try again.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="shippingDistrict" className="mb-2 block text-sm font-medium text-muted-foreground">
              District
            </label>
            <div className="relative">
              <MapPinIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                id="shippingDistrict"
                value={districtId}
                onChange={(event) => selectDistrict(event.target.value ? Number(event.target.value) : '')}
                disabled={disabled || loading}
                className="block w-full appearance-none rounded-lg border-input bg-background py-2.5 pl-9 text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:opacity-60"
                required
              >
                <option value="">{loading ? 'Loading districts…' : 'Select district'}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>{district.text}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative trans-express-confirm-city">
            <label htmlFor="shippingCity" className="mb-2 block text-sm font-medium text-muted-foreground">
              City
            </label>
            <div className="relative">
              <BuildingOfficeIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="shippingCity"
                type="text"
                value={citySearch}
                onChange={(event) => {
                  setCitySearch(event.target.value);
                  setShowCities(true);
                  onChange(undefined);
                }}
                onFocus={() => setShowCities(true)}
                disabled={disabled || loading || loadingCities || !districtId}
                placeholder={loadingCities ? 'Loading cities…' : districtId ? 'Search and select city' : 'Select district first'}
                autoComplete="off"
                className="block w-full rounded-lg border-input bg-background py-2.5 pl-9 text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:opacity-60"
                required
              />
            </div>
            {showCities && districtId && !loading && !loadingCities && (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {filteredCities.length > 0 ? filteredCities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCity(city)}
                    className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
                  >
                    {city.text}
                  </button>
                )) : (
                  <div className="px-4 py-2 text-sm text-muted-foreground">No cities found</div>
                )}
              </div>
            )}
            {cityError && <p className="mt-1.5 text-xs text-destructive">{cityError}. Select the district again to retry.</p>}
          </div>
        </div>
      )}

      {value && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <MapPinIcon className="h-3.5 w-3.5" />
          Saved for shipping: {value.cityName}, {value.districtName}
        </p>
      )}
    </div>
  );
}
