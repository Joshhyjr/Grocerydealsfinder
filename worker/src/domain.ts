import type {
  BasketResponseData,
  BasketStoreResult,
  CachedProduct,
  PriceSnapshot,
  SearchResponseData,
} from './types';

const HALIFAX_CENTER = { lat: 44.6488, lng: -63.5752 };

export function normalizePostalCode(postalCode: string): string {
  return postalCode.trim().toUpperCase().replace(/\s+/g, '');
}

export function regionFromPostalCode(postalCode: string, defaultRegion: string): string {
  const prefix = normalizePostalCode(postalCode).slice(0, 3);
  return prefix.startsWith('B3') || prefix.startsWith('B4') ? 'halifax-metro' : defaultRegion;
}

export function searchSnapshot(
  snapshot: PriceSnapshot,
  query: string,
  postalCode: string,
): SearchResponseData {
  const normalizedQuery = normalizeTerm(query);
  const results = selectPreferredProducts(snapshot.products)
    .filter((product) => productMatches(product, normalizedQuery))
    .sort((left, right) => left.price - right.price)
    .slice(0, 100)
    .map((product) => ({
      store: product.store,
      name: product.name,
      brand: product.brand,
      price: product.price,
      price_str: formatPrice(product.price),
      was_price: product.was_price == null ? null : formatPrice(product.was_price),
      unit_price: product.unit,
      image: product.image,
      link: product.link,
      rating: null,
      reviews: null,
      source: product.source,
      source_kind: product.source_kind,
      observed_at: product.observed_at,
      attribution_url: product.attribution_url,
      valid_until: product.valid_until,
    }));

  return {
    query,
    postal_code: normalizePostalCode(postalCode),
    total: results.length,
    sources: unique(results.map((result) => result.source)),
    failed: providerFailures(snapshot),
    cached: true,
    results,
    data_source: snapshot.data_source,
    fallback_reason: snapshot.data_source === 'estimate'
      ? 'No approved live provider snapshot is available yet.'
      : null,
    snapshot_generated_at: snapshot.generated_at,
    snapshot_stale: isSnapshotStale(snapshot),
  };
}

export function basketSnapshot(
  snapshot: PriceSnapshot,
  requestedItems: string[],
  postalCode: string,
): BasketResponseData {
  const preferredProducts = selectPreferredProducts(snapshot.products);
  const storeProducts = groupByStore(preferredProducts);
  const stores: BasketStoreResult[] = [];

  for (const products of storeProducts.values()) {
    const representative = products[0];
    const breakdown = requestedItems.flatMap((item) => {
      const match = cheapestMatch(products, item);
      if (!match) {
        return [];
      }

      return [{
        item,
        name: match.name,
        price: match.price,
        price_str: formatPrice(match.price),
        unit_price: match.unit,
        store: match.store,
        link: match.link,
        source: match.source,
        source_kind: match.source_kind,
        observed_at: match.observed_at,
        attribution_url: match.attribution_url,
      }];
    });
    const availableItems = breakdown.map((item) => item.item);
    const missingItems = requestedItems.filter((item) => !availableItems.includes(item));
    const totalCost = roundCurrency(breakdown.reduce((sum, item) => sum + item.price, 0));

    stores.push({
      store_id: representative.store_id,
      store: representative.store,
      address: representative.address,
      region: snapshot.region,
      coordinates: representative.coordinates,
      total_cost: totalCost,
      total_cost_str: formatPrice(totalCost),
      available_items: availableItems,
      missing_items: missingItems,
      breakdown,
      available_count: availableItems.length,
      missing_count: missingItems.length,
      is_best_price: false,
    });
  }

  // Complete baskets rank ahead of partial baskets, then by total price.
  stores.sort((left, right) =>
    right.available_count - left.available_count || left.total_cost - right.total_cost
  );
  const bestAvailability = stores[0]?.available_count ?? 0;
  const bestStore = stores
    .filter((store) => store.available_count === bestAvailability)
    .reduce<BasketStoreResult | null>((best, store) =>
      !best || store.total_cost < best.total_cost ? store : best
    , null);
  const rankedStores = stores.map((store) => ({
    ...store,
    is_best_price: store.store_id === bestStore?.store_id,
  }));

  return {
    items: requestedItems,
    postal_code: normalizePostalCode(postalCode),
    region: snapshot.region,
    user_coordinates: snapshot.region === 'halifax-metro' ? HALIFAX_CENTER : null,
    total_stores: rankedStores.length,
    stores: rankedStores,
    searches: Object.fromEntries(requestedItems.map((item) => {
      const matchingProducts = preferredProducts.filter((product) => productMatches(product, normalizeTerm(item)));
      return [item, {
        total: matchingProducts.length,
        sources: unique(matchingProducts.map((product) => product.source)),
        failed: providerFailures(snapshot),
        cached: true as const,
      }];
    })),
    data_source: snapshot.data_source,
    fallback_reason: snapshot.data_source === 'estimate'
      ? 'No approved live provider snapshot is available yet.'
      : null,
    snapshot_generated_at: snapshot.generated_at,
    snapshot_stale: isSnapshotStale(snapshot),
  };
}

export function isSnapshotStale(snapshot: PriceSnapshot, now = new Date()): boolean {
  return Date.parse(snapshot.expires_at) <= now.getTime();
}

// Community and Open Prices records are intentionally short-lived so an old
// observation never silently becomes a permanent "current" price.
export function removeExpiredOpenData(snapshot: PriceSnapshot, now = new Date()): PriceSnapshot {
  const maxAgeMs = 14 * 24 * 60 * 60 * 1000;
  return {
    ...snapshot,
    products: snapshot.products.filter((product) => {
      if (product.source_kind !== 'community' && product.source_kind !== 'open-prices') {
        return true;
      }
      const observedAt = product.observed_at ? Date.parse(product.observed_at) : Number.NaN;
      return Number.isFinite(observedAt) && observedAt + maxAgeMs > now.getTime();
    }),
  };
}

export function validateSnapshot(value: unknown): PriceSnapshot {
  if (!isRecord(value) || value.schema_version !== 1 || typeof value.region !== 'string') {
    throw new Error('Snapshot must use schema_version 1 and include a region.');
  }
  if (!isIsoDate(value.generated_at) || !isIsoDate(value.expires_at)) {
    throw new Error('Snapshot timestamps must be valid ISO dates.');
  }
  if (value.data_source !== 'live' && value.data_source !== 'estimate') {
    throw new Error('Snapshot data_source must be live or estimate.');
  }
  if (!Array.isArray(value.products) || value.products.length === 0 || value.products.length > 20_000) {
    throw new Error('Snapshot products must contain between 1 and 20,000 items.');
  }

  const products = value.products.map(validateProduct);
  const providerStatus = Array.isArray(value.provider_status)
    ? value.provider_status.filter(isProviderStatus)
    : [];

  return {
    schema_version: 1,
    region: value.region,
    generated_at: value.generated_at,
    expires_at: value.expires_at,
    data_source: value.data_source,
    provider_status: providerStatus,
    products,
  };
}

function validateProduct(value: unknown): CachedProduct {
  if (!isRecord(value)) {
    throw new Error('Every product must be an object.');
  }

  const requiredStrings = ['id', 'store_id', 'store', 'name', 'source'] as const;
  for (const field of requiredStrings) {
    if (typeof value[field] !== 'string' || value[field].trim() === '') {
      throw new Error(`Product ${field} must be a non-empty string.`);
    }
  }
  if (typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price < 0) {
    throw new Error('Product price must be a non-negative number.');
  }
  if (!Array.isArray(value.aliases) || !value.aliases.every((alias) => typeof alias === 'string')) {
    throw new Error('Product aliases must be an array of strings.');
  }

  return {
    id: requiredString(value.id),
    store_id: requiredString(value.store_id),
    store: requiredString(value.store),
    name: requiredString(value.name),
    aliases: value.aliases,
    brand: nullableString(value.brand),
    price: roundCurrency(value.price),
    was_price: nullableNumber(value.was_price),
    unit: nullableString(value.unit),
    image: nullableString(value.image),
    link: nullableString(value.link),
    source: requiredString(value.source),
    source_kind: validateSourceKind(value.source_kind, value.source),
    observed_at: nullableDateString(value.observed_at),
    attribution_url: nullableHttpsUrl(value.attribution_url),
    valid_until: nullableString(value.valid_until),
    address: nullableString(value.address),
    coordinates: validateCoordinates(value.coordinates),
  };
}

function productMatches(product: CachedProduct, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return false;
  }
  return [product.name, product.brand ?? '', ...product.aliases]
    .some((candidate) => normalizeTerm(candidate).includes(normalizedQuery));
}

function cheapestMatch(products: CachedProduct[], query: string): CachedProduct | null {
  const normalizedQuery = normalizeTerm(query);
  return products
    .filter((product) => productMatches(product, normalizedQuery))
    .reduce<CachedProduct | null>((best, product) => {
      // Prefer live/community observations over seed estimates even when the
      // provider uses a more specific product name such as "2% Milk."
      return !best || compareSourcePriority(product, best) < 0 ? product : best;
    }, null);
}

function selectPreferredProducts(products: CachedProduct[]): CachedProduct[] {
  const preferred = new Map<string, CachedProduct>();
  for (const product of products) {
    const identity = `${product.store_id}:${normalizeTerm(product.name)}`;
    const current = preferred.get(identity);
    if (!current || compareSourcePriority(product, current) < 0) {
      preferred.set(identity, product);
    }
  }
  return [...preferred.values()];
}

function compareSourcePriority(left: CachedProduct, right: CachedProduct): number {
  const priority = {
    provider: 4,
    community: 3,
    'open-prices': 3,
    estimate: 1,
  } satisfies Record<CachedProduct['source_kind'], number>;
  const priorityDifference = priority[right.source_kind] - priority[left.source_kind];
  if (priorityDifference !== 0) {
    return priorityDifference;
  }
  const leftObserved = left.observed_at ? Date.parse(left.observed_at) : 0;
  const rightObserved = right.observed_at ? Date.parse(right.observed_at) : 0;
  if (leftObserved !== rightObserved) {
    return rightObserved - leftObserved;
  }
  return left.price - right.price;
}

function groupByStore(products: CachedProduct[]): Map<string, CachedProduct[]> {
  const grouped = new Map<string, CachedProduct[]>();
  for (const product of products) {
    const current = grouped.get(product.store_id) ?? [];
    current.push(product);
    grouped.set(product.store_id, current);
  }
  return grouped;
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9%]+/g, ' ');
}

function providerFailures(snapshot: PriceSnapshot): Array<{ store: string; error: string }> {
  return snapshot.provider_status
    .filter((status) => !status.success && status.error)
    .map((status) => ({ store: status.provider, error: status.error ?? 'Provider refresh failed.' }));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a validated string.');
  }
  return value;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? roundCurrency(value) : null;
}

function validateSourceKind(value: unknown, source: unknown): CachedProduct['source_kind'] {
  return value === 'open-prices'
    || value === 'community'
    || value === 'provider'
    || value === 'estimate'
    ? value
    : source === 'seed-catalogue'
      ? 'estimate'
      : source === 'Community report'
        ? 'community'
        : source === 'Open Prices'
          ? 'open-prices'
          : 'provider';
}

function nullableDateString(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

function nullableHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function validateCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (value == null) {
    return null;
  }
  if (
    !isRecord(value)
    || typeof value.lat !== 'number'
    || typeof value.lng !== 'number'
    || !Number.isFinite(value.lat)
    || !Number.isFinite(value.lng)
  ) {
    throw new Error('Product coordinates must contain numeric lat and lng values.');
  }
  return { lat: value.lat, lng: value.lng };
}

function isProviderStatus(value: unknown): value is PriceSnapshot['provider_status'][number] {
  return isRecord(value)
    && typeof value.provider === 'string'
    && typeof value.success === 'boolean'
    && (typeof value.error === 'string' || value.error === null);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
