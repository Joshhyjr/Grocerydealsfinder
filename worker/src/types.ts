export interface Coordinates {
  lat: number;
  lng: number;
}

export interface CachedProduct {
  id: string;
  store_id: string;
  store: string;
  name: string;
  aliases: string[];
  brand: string | null;
  price: number;
  was_price: number | null;
  unit: string | null;
  image: string | null;
  link: string | null;
  source: string;
  source_kind: 'estimate' | 'open-prices' | 'community' | 'provider';
  observed_at: string | null;
  attribution_url: string | null;
  valid_until: string | null;
  address: string | null;
  coordinates: Coordinates | null;
}

export interface PriceSnapshot {
  schema_version: 1;
  region: string;
  generated_at: string;
  expires_at: string;
  data_source: 'live' | 'estimate';
  provider_status: Array<{
    provider: string;
    success: boolean;
    error: string | null;
  }>;
  products: CachedProduct[];
}

export interface ProviderPayload {
  region: string;
  generated_at?: string;
  expires_at?: string;
  products: CachedProduct[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface SearchResult {
  store: string;
  name: string;
  brand: string | null;
  price: number;
  price_str: string;
  was_price: string | null;
  unit_price: string | null;
  image: string | null;
  link: string | null;
  rating: null;
  reviews: null;
  source: string;
  source_kind: CachedProduct['source_kind'];
  observed_at: string | null;
  attribution_url: string | null;
  valid_until: string | null;
}

export interface SearchResponseData {
  query: string;
  postal_code: string;
  total: number;
  sources: string[];
  failed: Array<{ store: string; error: string }>;
  cached: true;
  results: SearchResult[];
  data_source: 'live' | 'estimate';
  fallback_reason: string | null;
  snapshot_generated_at: string;
  snapshot_stale: boolean;
}

export interface BasketBreakdownItem {
  item: string;
  name: string;
  price: number;
  price_str: string;
  unit_price: string | null;
  store: string;
  link: string | null;
  source: string;
  source_kind: CachedProduct['source_kind'];
  observed_at: string | null;
  attribution_url: string | null;
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
  store_id: string;
  store: string;
  address: string | null;
  region: string;
  coordinates: Coordinates | null;
  total_cost: number;
  total_cost_str: string;
  available_items: string[];
  missing_items: string[];
  breakdown: BasketBreakdownItem[];
  available_count: number;
  missing_count: number;
  is_best_price: boolean;
}

export interface BasketResponseData {
  items: string[];
  postal_code: string;
  region: string;
  user_coordinates: Coordinates | null;
  total_stores: number;
  stores: BasketStoreResult[];
  searches: Record<
    string,
    {
      total: number;
      sources: string[];
      failed: Array<{ store: string; error: string }>;
      cached: true;
    }
  >;
  data_source: 'live' | 'estimate';
  fallback_reason: string | null;
  snapshot_generated_at: string;
  snapshot_stale: boolean;
}
