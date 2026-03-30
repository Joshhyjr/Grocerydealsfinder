import {
  calculateDistanceKm,
  getRegionForPostalCode,
  getStoreRegistryEntry,
  StoreCoordinates,
} from './storeRegistry';

// ──────────────────────────────────────────────
// API CONFIG
// The frontend talks to the FastAPI backend on localhost by
// default, but the base URL stays overridable for deployment.
// ──────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const APPROX_CITY_DRIVE_KMH = 40;
const MAX_STORE_DRIVE_MINUTES = 20;

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
  postalCode: string,
  signal?: AbortSignal,
): Promise<BasketResponseData> {
  const params = new URLSearchParams({
    items: items.join(','),
    postal_code: normalizePostalCode(postalCode),
  });
  const basketData = await fetchApi<BasketResponseData>(`/basket?${params.toString()}`, signal);
  return enrichBasketResponse(basketData, postalCode);
}

export async function fetchSuggestions(
  query: string,
  postalCode: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!query.trim()) {
    return [];
  }

  const searchData = await fetchSearchResults(query, postalCode || 'B3K9Z0', signal);
  const uniqueNames = new Set<string>();

  for (const result of searchData.results) {
    if (result.name) {
      uniqueNames.add(result.name);
    }
    if (uniqueNames.size >= 5) {
      break;
    }
  }

  return Array.from(uniqueNames);
}

function enrichBasketResponse(basketData: BasketResponseData, postalCode: string): BasketResponseData {
  const region = getRegionForPostalCode(postalCode);
  const userCoordinates = basketData.user_coordinates ?? region?.center ?? null;

  // This compatibility layer lets the frontend ship nearest-store UX now while
  // still accepting the richer metadata directly from the backend later.
  const stores = basketData.stores
    .map((storeResult) => {
      const registryEntry = getStoreRegistryEntry(storeResult.store, basketData.region ?? region?.key ?? null);
      const coordinates = storeResult.coordinates ?? registryEntry?.coordinates ?? null;
      const distanceKm =
        storeResult.distance_km ??
        (userCoordinates && coordinates ? calculateDistanceKm(userCoordinates, coordinates) : null);
      const driveMinutes = distanceKm != null ? Math.round((distanceKm / APPROX_CITY_DRIVE_KMH) * 60) : null;

      return {
        ...storeResult,
        store_id: storeResult.store_id ?? registryEntry?.id ?? null,
        address: storeResult.address ?? registryEntry?.address ?? null,
        region: storeResult.region ?? basketData.region ?? region?.key ?? null,
        coordinates,
        distance_km: distanceKm,
        drive_minutes: driveMinutes,
      };
    })
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
    postal_code: normalizePostalCode(postalCode),
    region: basketData.region ?? region?.key ?? null,
    user_coordinates: userCoordinates,
    total_stores: storesWithFlags.length,
    stores: storesWithFlags,
  };
}

function compareDistance(left: number | null | undefined, right: number | null | undefined): number {
  const normalizedLeft = Number.isFinite(left ?? NaN) ? left ?? 0 : Number.POSITIVE_INFINITY;
  const normalizedRight = Number.isFinite(right ?? NaN) ? right ?? 0 : Number.POSITIVE_INFINITY;
  return normalizedLeft - normalizedRight;
}
