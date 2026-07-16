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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [districtResponse, cityResponse] = await Promise.all([
          fetch('/api/shipping/locations/districts'),
          fetch('/api/shipping/locations/cities'),
        ]);
        const [districtData, cityData] = await Promise.all([
          districtResponse.json(),
          cityResponse.json(),
        ]);
        if (!districtResponse.ok) throw new Error(districtData.error || 'Failed to load courier districts');
        if (!cityResponse.ok) throw new Error(cityData.error || 'Failed to load courier cities');
        if (cancelled) return;

        const loadedDistricts: District[] = districtData.districts || [];
        const loadedCities: City[] = cityData.cities || [];
        setDistricts(loadedDistricts);
        setCities(loadedCities);

        // Imported leads often already contain a city name. When it exactly
        // matches the courier list, complete both fields without operator input.
        if (!value && suggestedCity?.trim()) {
          const normalizedSuggestion = suggestedCity.trim().toLowerCase();
          const matchingCities = loadedCities.filter(
            (city) => city.text.trim().toLowerCase() === normalizedSuggestion,
          );
          if (matchingCities.length === 1 && matchingCities[0].district_id) {
            const city = matchingCities[0];
            const district = loadedDistricts.find((item) => item.id === city.district_id);
            if (district) {
              setDistrictId(district.id);
              setCitySearch(city.text);
              onChange({
                provider: 'TRANS_EXPRESS',
                districtId: district.id,
                districtName: district.text,
                cityId: city.id,
                cityName: city.text,
              });
            }
          }
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load courier locations');
      } finally {
        if (!cancelled) {
          setLoading(false);
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
    const query = citySearch.trim().toLowerCase();
    return cities
      .filter((city) => (!districtId || city.district_id === districtId)
        && (!query || city.text.toLowerCase().includes(query)))
      .slice(0, 50);
  }, [cities, districtId, citySearch]);

  const selectDistrict = (nextDistrictId: number | '') => {
    const firstSelection = districtId === '';
    setDistrictId(nextDistrictId);
    setCitySearch(firstSelection ? (suggestedCity || '') : '');
    setShowCities(false);
    setCityError(null);
    onChange(undefined);

    if (nextDistrictId) setShowCities(true);
  };

  const selectCity = (city: City) => {
    const matchingDistrictId = city.district_id || districtId;
    const district = districts.find((item) => item.id === matchingDistrictId);
    if (!district) {
      setCityError('The courier did not provide a district for this city');
      return;
    }
    setDistrictId(district.id);
    setCitySearch(city.text);
    setShowCities(false);
    setCityError(null);
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
          Select the city and its district will be filled automatically. This location will be reused for bulk shipping.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}. Refresh the page to try again.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  setDistrictId('');
                  setShowCities(true);
                  onChange(undefined);
                }}
                onFocus={() => setShowCities(true)}
                disabled={disabled || loading}
                placeholder={loading ? 'Loading cities…' : 'Search and select city'}
                autoComplete="off"
                className="block w-full rounded-lg border-input bg-background py-2.5 pl-9 text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm disabled:opacity-60"
                required
              />
            </div>
            {showCities && !loading && (
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
                    {city.district_id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {districts.find((district) => district.id === city.district_id)?.text}
                      </span>
                    )}
                  </button>
                )) : (
                  <div className="px-4 py-2 text-sm text-muted-foreground">No cities found</div>
                )}
              </div>
            )}
            {cityError && <p className="mt-1.5 text-xs text-destructive">{cityError}. Please choose the district manually.</p>}
          </div>

          <div>
            <label htmlFor="shippingDistrict" className="mb-2 block text-sm font-medium text-muted-foreground">
              District <span className="text-xs font-normal">(auto-selected)</span>
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
                <option value="">{loading ? 'Loading districts…' : 'Select a city first'}</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>{district.text}</option>
                ))}
              </select>
            </div>
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
