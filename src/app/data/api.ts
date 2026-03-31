import {
  calculateDistanceKm,
  chooseBestStoreRegistryEntry,
  getRegionForPostalCode,
  StoreCoordinates,
} from './storeRegistry';
import { GroceryListItem } from './groceryData';
import { ActiveLocation } from './location';
import { buildSearchExpansionPlan, SearchExpansionPlan, expandSearchQuery } from './searchIntelligence';

// ──────────────────────────────────────────────
// API CONFIG
// The frontend talks to the FastAPI backend on localhost by
// default, but the base URL stays overridable for deployment.
// ──────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const APPROX_CITY_DRIVE_KMH = 40;
const MAX_STORE_DRIVE_MINUTES = 20;
const CANADIAN_POSTAL_CODE_PATTERN = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;
const US_ZIP_CODE_PATTERN = /^\d{5}(?:-\d{4})?$/;
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// ──────────────────────────────────────────────
// SHARED TYPES
// These interfaces mirror the FastAPI response envelopes so
// pages can work with strongly typed live backend data.
// ──────────────────────────────────────────────
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface ProductResult {
  store: string;
  name: string;
  brand: string | null;
  price: number | null;
  price_str: string | null;
  was_price: string | null;
  unit_price: string | null;
  image: string | null;
  link: string | null;
  rating: number | null;
  reviews: number | null;
  source: string;
  valid_until?: string | null;
  unit_price_normalized?: number | null;
  unit_price_unit?: string | null;
}

export interface SearchResponseData {
  query: string;
  postal_code: string;
  location_label?: string | null;
  location_source?: string | null;
  user_coordinates?: StoreCoordinates | null;
  total: number;
  sources: string[];
  failed: Array<{ store: string; error: string }>;
  cached: boolean;
  results: ProductResult[];
}

export interface BasketBreakdownItem {
  item: string;
  name: string | null;
  price: number | null;
  price_str: string | null;
  unit_price: string | null;
  store: string;
  link: string | null;
  source: string;
}

export interface BasketStoreResult {
  store_id?: string | null;
  store: string;
  source?: string | null;
  address?: string | null;
  region?: string | null;
  distance_km?: number | null;
  drive_minutes?: number | null;
  is_within_drive_window?: boolean;
  coordinates?: StoreCoordinates | null;
  is_nearest?: boolean;
  is_best_price?: boolean;
  total_cost: number;
  total_cost_str: string;
  available_items: string[];
  missing_items: string[];
  breakdown: BasketBreakdownItem[];
  available_count: number;
  missing_count: number;
}

export interface BasketResponseData {
  items: string[];
  postal_code: string;
  location_label?: string | null;
  location_source?: string | null;
  region?: string | null;
  user_coordinates?: StoreCoordinates | null;
  total_stores: number;
  stores: BasketStoreResult[];
  searches: Record<
    string,
    {
      total: number;
      sources: string[];
      failed: Array<{ store: string; error: string }>;
      cached: boolean;
    }
  >;
}

// ──────────────────────────────────────────────
// FETCH HELPERS
// Centralizing request and error handling keeps the pages clean
// and gives all frontend calls the same failure behavior.
// ──────────────────────────────────────────────
async function fetchApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!payload.success || !payload.data) {
    throw new Error(payload.error || 'The backend returned an empty response.');
  }

  return payload.data;
}

// ──────────────────────────────────────────────
// QUERY HELPERS
// Postal codes are normalized before requests so the backend
// sees a consistent Canadian postal-code shape in every call.
// ──────────────────────────────────────────────
export function normalizePostalCode(postalCode: string): string {
  return postalCode.trim().toUpperCase().replace(/\s+/g, '');
}

export function isPostalCodeInput(value: string): boolean {
  const normalized = normalizePostalCode(value);
  return CANADIAN_POSTAL_CODE_PATTERN.test(normalized) || US_ZIP_CODE_PATTERN.test(normalized);
}

// Freeform location input keeps the UI flexible while the backend continues to
// receive the postal code field it already understands.
export async function resolveLocationInput(locationInput: string): Promise<ActiveLocation> {
  const trimmedLocation = locationInput.trim();
  if (!trimmedLocation) {
    throw new Error('Enter an address or postal code to continue.');
  }

  const inputLooksLikePostalCode = isPostalCodeInput(trimmedLocation);

  const params = new URLSearchParams({
    q: trimmedLocation,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'ca',
  });

  const results = await fetchLocationLookup<Array<NominatimLookupResult>>(
    `${NOMINATIM_BASE_URL}/search?${params.toString()}`,
  );
  const firstResult = results[0];
  const postalCode = extractPostalCode(firstResult?.address?.postcode);

  if (!postalCode && inputLooksLikePostalCode) {
    return {
      input: trimmedLocation,
      label: normalizePostalCode(trimmedLocation),
      postalCode: normalizePostalCode(trimmedLocation),
      coordinates: null,
      source: 'postal_code',
    };
  }

  if (!postalCode) {
    throw new Error('We could not match that address to a postal code.');
  }

  const shortAddress = firstResult ? formatStreetAddress(firstResult) : null;

  return {
    input: trimmedLocation,
    // Forward geocoding stores the shorter street-level label so the UI can
    // say "comparing to X street" instead of repeating the full address blob.
    label: shortAddress || firstResult?.display_name || trimmedLocation,
    postalCode,
    coordinates: firstResult ? { lat: Number(firstResult.lat), lng: Number(firstResult.lon) } : null,
    source: inputLooksLikePostalCode ? 'postal_code' : 'address',
  };
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<ActiveLocation> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: latitude.toString(),
    lon: longitude.toString(),
  });

  const result = await fetchLocationLookup<NominatimLookupResult>(
    `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`,
  );
  const postalCode = extractPostalCode(result.address?.postcode);

  if (!postalCode) {
    throw new Error('We found your location, but not a postal code for it yet.');
  }

  // Geolocation labels stay intentionally short so the UI shows only the
  // street-level address instead of the full reverse-geocoded identity string.
  const shortAddress = formatStreetAddress(result) || result.display_name || 'Current location';

  return {
    input: shortAddress,
    label: shortAddress,
    postalCode,
    coordinates: { lat: latitude, lng: longitude },
    source: 'geolocation',
  };
}

export async function fetchSearchResults(
  query: string,
  postalCode: string,
  signal?: AbortSignal,
): Promise<SearchResponseData> {
  const params = new URLSearchParams({
    q: query,
    postal_code: normalizePostalCode(postalCode),
  });
  return fetchApi<SearchResponseData>(`/search?${params.toString()}`, signal);
}

export async function fetchBasketResults(
  items: string[],
  location: ActiveLocation,
  signal?: AbortSignal,
): Promise<BasketResponseData> {
  // Broad terms are expanded before the backend search so generic requests like
  // "chicken" can still surface common cuts without changing the shopper's list label.
  const searchPlan = buildSearchExpansionPlan(items);
  const expandedItems = Array.from(new Set(searchPlan.flatMap((plan) => plan.queries)));
  const params = new URLSearchParams({
    items: expandedItems.join(','),
    postal_code: normalizePostalCode(location.postalCode),
    location_label: location.label,
    location_source: location.source,
  });

  if (location.coordinates) {
    params.set('lat', location.coordinates.lat.toString());
    params.set('lng', location.coordinates.lng.toString());
  }

  const basketData = await fetchApi<BasketResponseData>(`/basket?${params.toString()}`, signal);
  return enrichBasketResponse(basketData, location, searchPlan);
}

export async function fetchSuggestions(
  query: string,
  postalCode: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!query.trim()) {
    return [];
  }

  const uniqueNames = new Set<string>();
  const expandedQueries = expandSearchQuery(query);

  // Generic words should fan out to likely variants so the suggestion list
  // reflects real products the shopper can add immediately.
  const searchResponses = await Promise.all(
    expandedQueries.map((expandedQuery) => fetchSearchResults(expandedQuery, postalCode || 'B3K9Z0', signal)),
  );

  for (const searchData of searchResponses) {
    for (const result of searchData.results) {
      if (result.name) {
        uniqueNames.add(result.name);
      }
      if (uniqueNames.size >= 5) {
        break;
      }
    }

    if (uniqueNames.size >= 5) {
      break;
    }
  }

  return Array.from(uniqueNames);
}

export function applyListQuantitiesToBasketData(
  basketData: BasketResponseData,
  listItems: GroceryListItem[],
): BasketResponseData {
  const stores = basketData.stores
    .map((storeResult) => {
      let totalCost = 0;
      let availableCount = 0;
      let missingCount = 0;
      const availableItems: string[] = [];
      const missingItems: string[] = [];

      listItems.forEach((listItem) => {
        const matchedItem = storeResult.breakdown.find((entry) => entry.item.toLowerCase() === listItem.name.toLowerCase());

        if (matchedItem?.price != null) {
          totalCost += matchedItem.price * listItem.quantity;
          availableCount += 1;
          availableItems.push(listItem.name);
          return;
        }

        missingCount += 1;
        missingItems.push(listItem.name);
      });

      return {
        ...storeResult,
        total_cost: roundToCurrency(totalCost),
        total_cost_str: formatCurrency(totalCost),
        available_count: availableCount,
        missing_count: missingCount,
        available_items: availableItems,
        missing_items: missingItems,
      };
    })
    // Search results now lead with the stores that can fulfill more of the
    // list, then break ties on actual basket price and finally distance.
    .sort((left, right) => {
      if (right.available_count !== left.available_count) {
        return right.available_count - left.available_count;
      }

      if (left.total_cost !== right.total_cost) {
        return left.total_cost - right.total_cost;
      }

      return compareDistance(left.distance_km, right.distance_km);
    });

  const cheapestStore = stores.reduce<typeof stores[number] | null>((bestStore, storeResult) => {
    if (!bestStore || storeResult.total_cost < bestStore.total_cost) {
      return storeResult;
    }
    return bestStore;
  }, null);

  return {
    ...basketData,
    stores: stores.map((storeResult) => ({
      ...storeResult,
      is_best_price: cheapestStore ? (storeResult.store_id ?? storeResult.store) === (cheapestStore.store_id ?? cheapestStore.store) : false,
    })),
  };
}

function enrichBasketResponse(
  basketData: BasketResponseData,
  location: ActiveLocation,
  searchPlan: SearchExpansionPlan[],
): BasketResponseData {
  const region = getRegionForPostalCode(location.postalCode);
  const userCoordinates = basketData.user_coordinates ?? location.coordinates ?? region?.center ?? null;

  // This compatibility layer lets the frontend ship nearest-store UX now while
  // still accepting the richer metadata directly from the backend later.
  const stores = basketData.stores
    .map((storeResult) => {
      const registryEntry = chooseBestStoreRegistryEntry(
        storeResult.store,
        basketData.region ?? region?.key ?? null,
        userCoordinates,
      );
      const coordinates = storeResult.coordinates ?? registryEntry?.coordinates ?? null;
      const distanceKm =
        storeResult.distance_km ??
        (userCoordinates && coordinates ? calculateDistanceKm(userCoordinates, coordinates) : null);
      const driveMinutes = distanceKm != null ? Math.round((distanceKm / APPROX_CITY_DRIVE_KMH) * 60) : null;

      return {
        ...storeResult,
        store_id: storeResult.store_id ?? registryEntry?.id ?? null,
        store: registryEntry?.displayName ?? storeResult.store,
        source: storeResult.source ?? storeResult.breakdown[0]?.source ?? null,
        address: storeResult.address ?? registryEntry?.address ?? null,
        region: storeResult.region ?? basketData.region ?? region?.key ?? null,
        coordinates,
        distance_km: distanceKm,
        drive_minutes: driveMinutes,
      };
    })
    .map((storeResult) => collapseExpandedStoreResults(storeResult, searchPlan))
    .sort((left, right) => compareDistance(left.distance_km, right.distance_km) || left.total_cost - right.total_cost);

  const cheapestStore = stores.reduce<typeof stores[number] | null>((bestStore, storeResult) => {
    if (!bestStore || storeResult.total_cost < bestStore.total_cost) {
      return storeResult;
    }
    return bestStore;
  }, null);

  const nearestStoreId = stores.find((storeResult) => Number.isFinite(storeResult.distance_km ?? NaN));
  const storesWithFlags = stores.map((storeResult) => {
    const storeIdentifier = storeResult.store_id ?? storeResult.store;
    return {
      ...storeResult,
      is_within_drive_window:
        storeResult.drive_minutes != null ? storeResult.drive_minutes <= MAX_STORE_DRIVE_MINUTES : false,
      is_nearest: nearestStoreId ? storeIdentifier === (nearestStoreId.store_id ?? nearestStoreId.store) : false,
      is_best_price: cheapestStore ? storeIdentifier === (cheapestStore.store_id ?? cheapestStore.store) : false,
    };
  });

  return {
    ...basketData,
    items: searchPlan.map((plan) => plan.originalItem),
    postal_code: normalizePostalCode(location.postalCode),
    location_label: basketData.location_label ?? location.label,
    location_source: basketData.location_source ?? location.source,
    region: basketData.region ?? region?.key ?? null,
    user_coordinates: userCoordinates,
    searches: collapseExpandedSearches(basketData.searches, searchPlan),
    total_stores: storesWithFlags.length,
    stores: storesWithFlags,
  };
}

function collapseExpandedStoreResults(storeResult: BasketStoreResult, searchPlan: SearchExpansionPlan[]): BasketStoreResult {
  const breakdown = searchPlan.flatMap((plan) => {
    const bestMatch = pickBestBreakdownEntry(storeResult.breakdown, plan);

    if (!bestMatch) {
      return [];
    }

    return [
      {
        ...bestMatch,
        item: plan.originalItem,
      },
    ];
  });
  const availableItems = breakdown.map((entry) => entry.item);
  const missingItems = searchPlan
    .map((plan) => plan.originalItem)
    .filter((originalItem) => !availableItems.some((item) => item.toLowerCase() === originalItem.toLowerCase()));
  const totalCost = roundToCurrency(breakdown.reduce((sum, entry) => sum + (entry.price ?? 0), 0));

  return {
    ...storeResult,
    available_items: availableItems,
    missing_items: missingItems,
    breakdown,
    available_count: availableItems.length,
    missing_count: missingItems.length,
    total_cost: totalCost,
    total_cost_str: formatCurrency(totalCost),
  };
}

function pickBestBreakdownEntry(
  breakdown: BasketBreakdownItem[],
  searchPlan: SearchExpansionPlan,
): BasketBreakdownItem | null {
  const matches = breakdown.filter((entry) =>
    searchPlan.queries.some((query) => normalizeSearchTerm(query) === normalizeSearchTerm(entry.item)),
  );

  if (matches.length === 0) {
    return null;
  }

  // Prefer exact shopper wording when it already matches, otherwise choose the
  // lowest-priced fallback variant for that broader grocery term.
  return [...matches].sort((left, right) => {
    const leftExact = normalizeSearchTerm(left.item) === normalizeSearchTerm(searchPlan.originalItem);
    const rightExact = normalizeSearchTerm(right.item) === normalizeSearchTerm(searchPlan.originalItem);

    if (leftExact !== rightExact) {
      return leftExact ? -1 : 1;
    }

    return (left.price ?? Number.POSITIVE_INFINITY) - (right.price ?? Number.POSITIVE_INFINITY);
  })[0];
}

function collapseExpandedSearches(
  searches: BasketResponseData['searches'],
  searchPlan: SearchExpansionPlan[],
): BasketResponseData['searches'] {
  return Object.fromEntries(
    searchPlan.map((plan) => {
      const matchingSearches = plan.queries
        .map((query) => searches[query])
        .filter((search): search is NonNullable<typeof search> => Boolean(search));

      return [
        plan.originalItem,
        {
          total: matchingSearches.reduce((sum, search) => sum + search.total, 0),
          sources: Array.from(new Set(matchingSearches.flatMap((search) => search.sources))),
          failed: matchingSearches.flatMap((search) => search.failed),
          cached: matchingSearches.length > 0 && matchingSearches.every((search) => search.cached),
        },
      ];
    }),
  );
}

function compareDistance(left: number | null | undefined, right: number | null | undefined): number {
  const normalizedLeft = Number.isFinite(left ?? NaN) ? left ?? 0 : Number.POSITIVE_INFINITY;
  const normalizedRight = Number.isFinite(right ?? NaN) ? right ?? 0 : Number.POSITIVE_INFINITY;
  return normalizedLeft - normalizedRight;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatCurrency(amount: number): string {
  return `$${roundToCurrency(amount).toFixed(2)}`;
}

function roundToCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

async function fetchLocationLookup<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Location lookup failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function extractPostalCode(postalCode: string | undefined): string | null {
  if (!postalCode) {
    return null;
  }

  const normalized = normalizePostalCode(postalCode);
  return isPostalCodeInput(normalized) ? normalized : null;
}

interface NominatimLookupResult {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
    neighbourhood?: string;
    postcode?: string;
  };
}

function formatStreetAddress(result: NominatimLookupResult): string | null {
  const address = result.address;
  if (!address) {
    return null;
  }

  const streetName = address.road || address.pedestrian || address.footway;
  if (!streetName) {
    return null;
  }

  return [address.house_number, streetName].filter(Boolean).join(' ');
}
