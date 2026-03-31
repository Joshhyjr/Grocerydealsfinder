import { StoreCoordinates } from './storeRegistry';

export type LocationSource = 'address' | 'postal_code' | 'geolocation';

export interface ActiveLocation {
  input: string;
  label: string;
  postalCode: string;
  coordinates: StoreCoordinates | null;
  source: LocationSource;
}

// Route params keep the location shareable on refresh while context keeps it
// easy for pages to reuse without reparsing everywhere.
export function buildLocationSearchParams(budget: string | number, location: ActiveLocation): URLSearchParams {
  const params = new URLSearchParams({
    budget: String(budget),
    postalCode: location.postalCode,
    locationInput: location.input,
    locationLabel: location.label,
    locationSource: location.source,
  });

  if (location.coordinates) {
    params.set('lat', location.coordinates.lat.toString());
    params.set('lng', location.coordinates.lng.toString());
  }

  return params;
}

export function readLocationFromSearchParams(searchParams: URLSearchParams): ActiveLocation | null {
  const postalCode = searchParams.get('postalCode');
  if (!postalCode) {
    return null;
  }

  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const source = searchParams.get('locationSource');

  return {
    input: searchParams.get('locationInput') || searchParams.get('locationLabel') || postalCode,
    label: searchParams.get('locationLabel') || postalCode,
    postalCode,
    coordinates: hasCoordinates ? { lat, lng } : null,
    source: isLocationSource(source) ? source : 'postal_code',
  };
}

export function getLocationDisplayName(location: ActiveLocation | null | undefined): string {
  if (!location) {
    return 'your area';
  }

  // Older saved locations may still contain full reverse-geocoded labels, so
  // we trim them here to keep every page aligned on a short street-level name.
  return shortenLocationLabel(location.label, location.source) || location.postalCode;
}

function isLocationSource(value: string | null): value is LocationSource {
  return value === 'address' || value === 'postal_code' || value === 'geolocation';
}

function shortenLocationLabel(label: string, source: LocationSource): string {
  if (!label) {
    return '';
  }

  if (source === 'postal_code') {
    return label;
  }

  return label.split(',')[0]?.trim() || label;
}
