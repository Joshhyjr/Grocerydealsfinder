import type { CachedProduct, PriceSnapshot } from './types';

const HALIFAX_STORES = {
  loblaws: {
    store_id: 'loblaws-hfx',
    store: 'Loblaws',
    address: '5840 Almon St, Halifax, NS',
    coordinates: { lat: 44.6604, lng: -63.6115 },
  },
  nofrills: {
    store_id: 'nofrills-hfx',
    store: 'No Frills',
    address: '3601 Joseph Howe Dr, Halifax, NS',
    coordinates: { lat: 44.6528, lng: -63.6268 },
  },
  rcss: {
    store_id: 'rcss-hfx',
    store: 'Real Canadian Superstore',
    address: '6141 Young St, Halifax, NS',
    coordinates: { lat: 44.6577, lng: -63.6103 },
  },
  walmart: {
    store_id: 'walmart-hfx',
    store: 'Walmart',
    address: '6990 Mumford Rd, Halifax, NS',
    coordinates: { lat: 44.6483, lng: -63.6204 },
  },
} as const;

const ITEMS = [
  { key: 'milk', name: 'Milk', aliases: ['milk', '2% milk', 'whole milk'], unit: '4 L' },
  { key: 'eggs', name: 'Eggs', aliases: ['egg', 'eggs', 'dozen eggs'], unit: '12 count' },
  { key: 'bread', name: 'Bread', aliases: ['bread', 'loaf', 'white bread', 'wheat bread'], unit: '675 g' },
  { key: 'bananas', name: 'Bananas', aliases: ['banana', 'bananas'], unit: '1 lb' },
  { key: 'chicken', name: 'Chicken Breast', aliases: ['chicken', 'chicken breast', 'poultry'], unit: '1 kg' },
  { key: 'rice', name: 'Rice', aliases: ['rice', 'white rice', 'basmati'], unit: '2 kg' },
] as const;

const ESTIMATE_PRICES: Record<keyof typeof HALIFAX_STORES, number[]> = {
  loblaws: [6.29, 4.99, 3.49, 0.79, 14.99, 8.99],
  nofrills: [5.79, 4.49, 2.99, 0.69, 13.49, 7.99],
  rcss: [5.99, 4.79, 3.29, 0.75, 13.99, 8.49],
  walmart: [5.89, 4.68, 2.97, 0.67, 12.97, 7.47],
};

// Seed prices are intentionally marked as estimates and are only used until a
// licensed or retailer-approved provider snapshot has been ingested.
export function createSeedSnapshot(now = new Date()): PriceSnapshot {
  const generatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const products: CachedProduct[] = [];

  for (const [storeKey, store] of Object.entries(HALIFAX_STORES) as Array<
    [keyof typeof HALIFAX_STORES, (typeof HALIFAX_STORES)[keyof typeof HALIFAX_STORES]]
  >) {
    ITEMS.forEach((item, itemIndex) => {
      products.push({
        id: `${store.store_id}-${item.key}`,
        ...store,
        name: item.name,
        aliases: [...item.aliases],
        brand: null,
        price: ESTIMATE_PRICES[storeKey][itemIndex],
        was_price: null,
        unit: item.unit,
        image: null,
        link: null,
        source: 'seed-catalogue',
        source_kind: 'estimate',
        observed_at: null,
        attribution_url: null,
        valid_until: null,
      });
    });
  }

  return {
    schema_version: 1,
    region: 'halifax-metro',
    generated_at: generatedAt,
    expires_at: expiresAt,
    data_source: 'estimate',
    provider_status: [{
      provider: 'seed-catalogue',
      success: true,
      error: null,
    }],
    products,
  };
}
