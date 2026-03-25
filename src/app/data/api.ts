// ──────────────────────────────────────────────
// API CONFIG
// The frontend talks to the FastAPI backend on localhost by
// default, but the base URL stays overridable for deployment.
// ──────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

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
  store: string;
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
  return fetchApi<BasketResponseData>(`/basket?${params.toString()}`, signal);
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
