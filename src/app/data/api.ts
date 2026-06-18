import {
  calculateDistanceKm,
  getRegionForPostalCode,
  getStoreRegistryEntry,
  StoreCoordinates,
} from './storeRegistry';
import {
  calculateBasketTotal,
  groceryItems,
  searchGroceryItems,
  stores as catalogStores,
} from './groceryData';

// ──────────────────────────────────────────────
// API CONFIG
// The frontend talks to the FastAPI backend on localhost by
// default, but the base URL stays overridable for deployment.
// ──────────────────────────────────────────────
// Production builds only call a live service when one is explicitly configured.
// This prevents GitHub Pages from trying to reach each visitor's localhost.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : null);
const API_TIMEOUT_MS = 6_000;
const APPROX_CITY_DRIVE_KMH = 40;
const MAX_STORE_DRIVE_MINUTES = 20;

// Community reporting is only shown when a real API endpoint exists; static
// estimate-only deployments should not present a form that cannot submit.
export const isCommunityReportingAvailable = Boolean(API_BASE_URL);

// The bundled catalogue keeps the static site useful when a scraper service is
// unavailable. Store identities use the real Halifax registry, while prices are
// clearly labelled as estimates rather than current advertised prices.
const FALLBACK_STORE_CATALOG = [
  { catalogIndex: 0, store: 'Loblaws' },
  { catalogIndex: 1, store: 'No Frills' },
  { catalogIndex: 2, store: 'Real Canadian Superstore' },
  { catalogIndex: 4, store: 'Walmart' },
] as const;

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
  source_kind?: 'estimate' | 'open-prices' | 'community' | 'provider';
  observed_at?: string | null;
  attribution_url?: string | null;
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
  // Consumers can distinguish current API data from the resilient estimate mode.
  data_source?: 'live' | 'estimate';
  fallback_reason?: string | null;
  snapshot_generated_at?: string | null;
  snapshot_stale?: boolean;
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
  source_kind?: 'estimate' | 'open-prices' | 'community' | 'provider';
  observed_at?: string | null;
  attribution_url?: string | null;
}

export interface CommunityPriceSubmission {
  product_name: string;
  store_id: string;
  store: string;
  price: number;
  unit: string | null;
  observed_at: string;
  postal_code: string;
  website: string;
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
  // The UI surfaces this metadata so estimated prices are never presented as live.
  data_source?: 'live' | 'estimate';
  fallback_reason?: string | null;
  snapshot_generated_at?: string | null;
  snapshot_stale?: boolean;
}

// Basket comparisons must favour coverage before price; otherwise a store with
// one cheap item can incorrectly beat a complete grocery basket.
export function compareBasketValue(left: BasketStoreResult, right: BasketStoreResult): number {
  return right.available_count - left.available_count || left.total_cost - right.total_cost;
}

// ──────────────────────────────────────────────
// FETCH HELPERS
// Centralizing request and error handling keeps the pages clean
// and gives all frontend calls the same failure behavior.
// ──────────────────────────────────────────────
async function fetchApi<T>(
  path: string,
  signal?: AbortSignal,
  requestInit: Omit<RequestInit, 'signal'> = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('No live grocery API is configured for this deployment.');
  }

  // Bound failed scraper/API requests so the UI can switch to its local estimate
  // instead of leaving the results screen in a loading state indefinitely.
  const requestController = new AbortController();
  const abortFromCaller = () => requestController.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = window.setTimeout(() => requestController.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: requestInit.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...requestInit.headers,
      },
      body: requestInit.body,
      signal: requestController.signal,
    });

    if (!response.ok) {
      const failurePayload = await response.json().catch(() => null) as ApiEnvelope<unknown> | null;
      throw new Error(failurePayload?.error || `Backend request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ApiEnvelope<T>;

    if (!payload.success || !payload.data) {
      throw new Error(payload.error || 'The backend returned an empty response.');
    }

    return payload.data;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
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

  try {
    const response = await fetchApi<SearchResponseData>(`/search?${params.toString()}`, signal);
    return { ...response, data_source: response.data_source ?? 'live' };
  } catch (error) {
    // Preserve intentional navigation/typing aborts; only service failures should
    // activate estimate mode.
    if (signal?.aborted) {
      throw error;
    }
    return buildFallbackSearchResponse(query, postalCode, getFallbackReason(error));
  }
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
  try {
    const basketData = await fetchApi<BasketResponseData>(`/basket?${params.toString()}`, signal);
    return enrichBasketResponse(
      { ...basketData, data_source: basketData.data_source ?? 'live' },
      postalCode,
    );
  } catch (error) {
    // A local estimate is preferable to a dead results page, but caller-driven
    // aborts still stop work immediately.
    if (signal?.aborted) {
      throw error;
    }
    return enrichBasketResponse(
      buildFallbackBasketResponse(items, postalCode, getFallbackReason(error)),
      postalCode,
    );
  }
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

export async function submitCommunityPrice(
  submission: CommunityPriceSubmission,
  signal?: AbortSignal,
): Promise<{ report_id: string; expires_at: string; message: string }> {
  return fetchApi('/community/prices', signal, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submission),
  });
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

  const bestBasketStore = stores.reduce<typeof stores[number] | null>((bestStore, storeResult) => {
    if (!bestStore || compareBasketValue(storeResult, bestStore) < 0) {
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
      is_best_price: bestBasketStore
        ? storeIdentifier === (bestBasketStore.store_id ?? bestBasketStore.store)
        : false,
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

// Convert the bundled catalogue into the same response contract as the live API
// so every page can share one rendering path.
function buildFallbackSearchResponse(
  query: string,
  postalCode: string,
  fallbackReason: string,
): SearchResponseData {
  const matches = searchGroceryItems(query);
  const results = FALLBACK_STORE_CATALOG.flatMap(({ catalogIndex, store }) => {
    const catalogStore = catalogStores[catalogIndex];

    return matches.flatMap<ProductResult>((item) => {
      const inventory = catalogStore.inventory.find((entry) => entry.itemId === item.id && entry.inStock);
      if (!inventory) {
        return [];
      }

      const price = inventory.salePrice ?? inventory.regularPrice;
      return [{
        store,
        name: item.name,
        brand: null,
        price,
        price_str: `$${price.toFixed(2)}`,
        was_price: inventory.salePrice ? `$${inventory.regularPrice.toFixed(2)}` : null,
        unit_price: inventory.unit,
        image: null,
        link: null,
        rating: null,
        reviews: null,
        source: 'bundled-catalogue',
        source_kind: 'estimate',
        observed_at: null,
        attribution_url: null,
      }];
    });
  }).sort((left, right) => (left.price ?? Number.POSITIVE_INFINITY) - (right.price ?? Number.POSITIVE_INFINITY));

  return {
    query,
    postal_code: normalizePostalCode(postalCode),
    total: results.length,
    sources: ['bundled-catalogue'],
    failed: [],
    cached: true,
    results,
    data_source: 'estimate',
    fallback_reason: fallbackReason,
    snapshot_generated_at: new Date().toISOString(),
    snapshot_stale: false,
  };
}

// Build basket estimates from the checked-in catalogue. The best store favours
// complete baskets first so a cheap but mostly-missing basket cannot win.
function buildFallbackBasketResponse(
  items: string[],
  postalCode: string,
  fallbackReason: string,
): BasketResponseData {
  const region = getRegionForPostalCode(postalCode);
  const stores = FALLBACK_STORE_CATALOG.map(({ catalogIndex, store }) => {
    const catalogStore = catalogStores[catalogIndex];
    const basket = calculateBasketTotal(catalogStore, items);
    const registryEntry = getStoreRegistryEntry(store, region?.key);
    const availableItems = basket.items.filter((item) => item.available);

    return {
      store_id: registryEntry?.id ?? null,
      store,
      address: registryEntry?.address ?? null,
      region: region?.key ?? null,
      coordinates: registryEntry?.coordinates ?? null,
      total_cost: basket.total,
      total_cost_str: `$${basket.total.toFixed(2)}`,
      available_items: availableItems.map((item) => item.name),
      missing_items: basket.missingItems,
      breakdown: availableItems.map((item) => ({
        item: items.find((requestedItem) => matchesCatalogueItem(requestedItem, item.name)) ?? item.name,
        name: item.name,
        price: item.price,
        price_str: `$${item.price.toFixed(2)}`,
        unit_price: item.unit,
        store,
        link: null,
        source: 'bundled-catalogue',
        source_kind: 'estimate',
        observed_at: null,
        attribution_url: null,
      })),
      available_count: basket.availableCount,
      missing_count: basket.missingItems.length,
    } satisfies BasketStoreResult;
  }).filter((store) => store.available_count > 0);

  stores.sort(compareBasketValue);

  const bestAvailability = stores[0]?.available_count ?? 0;
  const bestStore = stores
    .filter((store) => store.available_count === bestAvailability)
    .reduce<(typeof stores)[number] | null>((best, store) => {
      return !best || store.total_cost < best.total_cost ? store : best;
    }, null);

  return {
    items,
    postal_code: normalizePostalCode(postalCode),
    region: region?.key ?? null,
    user_coordinates: region?.center ?? null,
    total_stores: stores.length,
    stores: stores.map((store) => ({
      ...store,
      is_best_price: store.store_id === bestStore?.store_id,
    })),
    searches: Object.fromEntries(items.map((item) => [
      item,
      {
        total: stores.filter((store) => store.available_items.some((name) => matchesCatalogueItem(item, name))).length,
        sources: ['bundled-catalogue'],
        failed: [],
        cached: true,
      },
    ])),
    data_source: 'estimate',
    fallback_reason: fallbackReason,
    snapshot_generated_at: new Date().toISOString(),
    snapshot_stale: false,
  };
}

// Match aliases such as "egg" and "Eggs" when connecting requested items to
// catalogue line items.
function matchesCatalogueItem(requestedItem: string, catalogueName: string): boolean {
  const normalizedRequest = requestedItem.trim().toLowerCase();
  const catalogueItem = groceryItems.find((item) => item.name === catalogueName);
  return catalogueItem?.name.toLowerCase() === normalizedRequest
    || catalogueItem?.commonNames.some((alias) => alias.toLowerCase() === normalizedRequest)
    || false;
}

// Keep implementation details out of user-facing notices while retaining a
// useful reason for debugging configured API deployments.
function getFallbackReason(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The live grocery service took too long to respond.';
  }
  return error instanceof Error ? error.message : 'The live grocery service is unavailable.';
}

function compareDistance(left: number | null | undefined, right: number | null | undefined): number {
  const normalizedLeft = Number.isFinite(left ?? NaN) ? left ?? 0 : Number.POSITIVE_INFINITY;
  const normalizedRight = Number.isFinite(right ?? NaN) ? right ?? 0 : Number.POSITIVE_INFINITY;
  return normalizedLeft - normalizedRight;
}
