import { describe, expect, it } from 'vitest';
import {
  basketSnapshot,
  isSnapshotStale,
  removeExpiredOpenData,
  searchSnapshot,
  validateSnapshot,
} from '../src/domain';
import { validateCommunitySubmission } from '../src/community';
import { normalizeOpenPrice } from '../src/open-prices';
import { snapshotFromUpload } from '../src/providers';
import { createSeedSnapshot } from '../src/seed';

describe('cached grocery domain', () => {
  it('returns store matches sorted by price', () => {
    const response = searchSnapshot(createSeedSnapshot(), 'milk', 'B3H 2Y7');

    expect(response.results).toHaveLength(4);
    expect(response.results[0].store).toBe('No Frills');
    expect(response.results[0].price).toBe(5.79);
    expect(response.data_source).toBe('estimate');
  });

  it('ranks complete baskets before partial baskets and marks the best price', () => {
    const response = basketSnapshot(createSeedSnapshot(), ['milk', 'eggs', 'bread'], 'B3H2Y7');

    expect(response.total_stores).toBe(4);
    expect(response.stores.every((store) => store.available_count === 3)).toBe(true);
    expect(response.stores.filter((store) => store.is_best_price)).toHaveLength(1);
    expect(response.stores.find((store) => store.is_best_price)?.store).toBe('No Frills');
  });

  it('prefers a live provider match over a cheaper estimate alias', () => {
    const snapshot = createSeedSnapshot();
    const estimate = snapshot.products.find((product) =>
      product.store_id === 'nofrills-hfx' && product.name === 'Milk'
    );
    if (!estimate) {
      throw new Error('Expected the No Frills milk seed fixture.');
    }

    // A provider may use a more specific product name, so alias matching must
    // still prevent the fallback estimate from masking the live observation.
    snapshot.products.push({
      ...estimate,
      id: 'provider-nofrills-2-percent-milk',
      name: '2% Milk',
      aliases: ['milk', '2% milk'],
      price: estimate.price + 1,
      source: 'test-provider',
      source_kind: 'provider',
      observed_at: '2026-06-18',
    });

    const response = basketSnapshot(snapshot, ['milk'], 'B3H2Y7');
    const noFrillsMilk = response.stores
      .find((store) => store.store_id === 'nofrills-hfx')
      ?.breakdown[0];

    expect(noFrillsMilk?.name).toBe('2% Milk');
    expect(noFrillsMilk?.source_kind).toBe('provider');
  });

  it('rejects malformed uploaded prices', () => {
    const snapshot = createSeedSnapshot();
    snapshot.products[0].price = -1;

    expect(() => validateSnapshot(snapshot)).toThrow('non-negative');
  });

  it('normalizes authenticated uploads into live snapshots', () => {
    const seed = createSeedSnapshot();
    const snapshot = snapshotFromUpload({
      region: seed.region,
      products: seed.products,
    }, '3600');

    expect(snapshot.data_source).toBe('live');
    expect(snapshot.provider_status[0].provider).toBe('authenticated-upload');
    expect(Date.parse(snapshot.expires_at)).toBeGreaterThan(Date.parse(snapshot.generated_at));
  });

  it('marks expired snapshots as stale without discarding them', () => {
    const snapshot = createSeedSnapshot(new Date('2026-06-17T00:00:00.000Z'));

    expect(isSnapshotStale(snapshot, new Date('2026-06-18T00:00:00.000Z'))).toBe(true);
    expect(searchSnapshot(snapshot, 'milk', 'B3H2Y7').snapshot_stale).toBe(true);
  });

  it('validates anonymous community reports without collecting personal data', () => {
    const today = new Date().toISOString().slice(0, 10);
    const report = validateCommunitySubmission({
      product_name: 'Milk',
      store_id: 'nofrills-hfx',
      store: 'No Frills',
      price: 5.79,
      unit: '4 L',
      observed_at: today,
      postal_code: 'B3H 2Y7',
      website: '',
    });

    expect(report.postal_code).toBe('B3H2Y7');
    expect(report.price).toBe(5.79);
    expect(Object.keys(report)).not.toContain('name');
    expect(Object.keys(report)).not.toContain('email');
  });

  it('rejects stale or bot-like community submissions', () => {
    expect(() => validateCommunitySubmission({
      product_name: 'Milk',
      store_id: 'nofrills-hfx',
      store: 'No Frills',
      price: 5.79,
      observed_at: '2020-01-01',
      postal_code: 'B3H2Y7',
      website: '',
    })).toThrow('last 14 days');

    expect(() => validateCommunitySubmission({
      product_name: 'Milk',
      store_id: 'nofrills-hfx',
      store: 'No Frills',
      price: 5.79,
      observed_at: new Date().toISOString().slice(0, 10),
      postal_code: 'B3H2Y7',
      website: 'spam.example',
    })).toThrow('rejected');
  });

  it('normalizes attributed Open Prices records', () => {
    const products = normalizeOpenPrice({
      id: 42,
      product_code: '1234567890123',
      product_name: null,
      price: 4.99,
      price_without_discount: 5.49,
      currency: 'CAD',
      date: new Date().toISOString().slice(0, 10),
      location: {
        id: 7,
        osm_name: 'Community Market',
        osm_display_name: '123 Example St, Halifax, NS',
        osm_lat: 44.65,
        osm_lon: -63.58,
      },
      product: {
        code: '1234567890123',
        product_name: 'Example Milk',
        image_url: null,
        product_quantity: 4,
        product_quantity_unit: 'L',
        brands: 'Example',
      },
    });

    expect(products[0].source_kind).toBe('open-prices');
    expect(products[0].attribution_url).toBe('https://prices.openfoodfacts.org/');
  });

  it('expires open and community observations after 14 days', () => {
    const snapshot = createSeedSnapshot();
    snapshot.products.push({
      ...snapshot.products[0],
      id: 'community-old',
      source: 'Community report',
      source_kind: 'community',
      observed_at: '2026-05-01',
    });

    expect(removeExpiredOpenData(snapshot, new Date('2026-06-18T00:00:00.000Z')).products)
      .not.toContainEqual(expect.objectContaining({ id: 'community-old' }));
  });
});
