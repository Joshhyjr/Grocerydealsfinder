import type { CachedProduct, ProviderPayload } from './types';

const OPEN_PRICES_BASE_URL = 'https://prices.openfoodfacts.org/api/v1';
const OPEN_PRICES_ATTRIBUTION_URL = 'https://prices.openfoodfacts.org/';
const HALIFAX_CENTER = { lat: 44.6488, lng: -63.5752 };
const MAX_PRICE_AGE_DAYS = 14;
const REQUEST_TIMEOUT_MS = 10_000;

interface OpenPricesLocation {
  id: number;
  osm_name: string | null;
  osm_display_name: string | null;
  osm_lat: number | null;
  osm_lon: number | null;
}

interface OpenPricesProduct {
  code: string | null;
  product_name: string | null;
  image_url: string | null;
  product_quantity: number | null;
  product_quantity_unit: string | null;
  brands: string | null;
}

interface OpenPrice {
  id: number;
  product_code: string | null;
  product_name: string | null;
  price: number;
  price_without_discount: number | null;
  currency: string | null;
  date: string;
  location: OpenPricesLocation | null;
  product: OpenPricesProduct | null;
}

interface PaginatedResponse<T> {
  items: T[];
}

// Open Prices currently has sparse Halifax coverage. This adapter remains
// intentionally read-only and simply returns null when no fresh CAD prices exist.
export async function fetchOpenPricesSnapshot(env: Env): Promise<ProviderPayload | null> {
  const locationsUrl = new URL(`${OPEN_PRICES_BASE_URL}/locations/nearby`);
  locationsUrl.searchParams.set('lat', String(HALIFAX_CENTER.lat));
  locationsUrl.searchParams.set('lon', String(HALIFAX_CENTER.lng));
  locationsUrl.searchParams.set('radius_km', env.OPEN_PRICES_RADIUS_KM);
  locationsUrl.searchParams.set('size', '100');
  const locations = await fetchJson<PaginatedResponse<OpenPricesLocation>>(locationsUrl);
  const locationIds = locations.items.map((location) => location.id);
  if (locationIds.length === 0) {
    return null;
  }

  const earliestDate = new Date(Date.now() - MAX_PRICE_AGE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const pricesUrl = new URL(`${OPEN_PRICES_BASE_URL}/prices`);
  pricesUrl.searchParams.set('currency', 'CAD');
  pricesUrl.searchParams.set('date__gte', earliestDate);
  pricesUrl.searchParams.set('location_id__in', locationIds.join(','));
  pricesUrl.searchParams.set('order_by', '-date');
  pricesUrl.searchParams.set('size', '100');
  const prices = await fetchJson<PaginatedResponse<OpenPrice>>(pricesUrl);
  const products = prices.items.flatMap(normalizeOpenPrice);
  if (products.length === 0) {
    return null;
  }

  return {
    region: 'halifax-metro',
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    products,
  };
}

export function normalizeOpenPrice(price: OpenPrice): CachedProduct[] {
  if (
    price.currency !== 'CAD'
    || !Number.isFinite(price.price)
    || price.price < 0
    || !price.location
  ) {
    return [];
  }
  const productName = price.product?.product_name ?? price.product_name;
  if (!productName) {
    return [];
  }

  const locationName = price.location.osm_name ?? 'Community-reported store';
  return [{
    id: `open-prices-${price.id}`,
    store_id: `open-prices-location-${price.location.id}`,
    store: locationName,
    name: productName,
    aliases: [productName],
    brand: price.product?.brands ?? null,
    price: price.price,
    was_price: price.price_without_discount,
    unit: formatProductUnit(price.product),
    image: price.product?.image_url ?? null,
    link: price.product_code
      ? `https://world.openfoodfacts.org/product/${encodeURIComponent(price.product_code)}`
      : null,
    source: 'Open Prices',
    source_kind: 'open-prices',
    observed_at: price.date,
    attribution_url: OPEN_PRICES_ATTRIBUTION_URL,
    valid_until: null,
    address: price.location.osm_display_name,
    coordinates: price.location.osm_lat != null && price.location.osm_lon != null
      ? { lat: price.location.osm_lat, lng: price.location.osm_lon }
      : null,
  }];
}

function formatProductUnit(product: OpenPricesProduct | null): string | null {
  if (!product?.product_quantity || !product.product_quantity_unit) {
    return null;
  }
  return `${product.product_quantity} ${product.product_quantity_unit}`;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Open Food Facts asks API consumers to identify their application.
        'User-Agent': 'GroceryDealsFinder/1.0 (https://github.com/Joshhyjr/Grocerydealsfinder)',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Open Prices returned status ${response.status}.`);
    }
    return await response.json<T>();
  } finally {
    clearTimeout(timeoutId);
  }
}
