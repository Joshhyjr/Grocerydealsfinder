import { normalizePostalCode, regionFromPostalCode } from './domain';
import { loadSnapshot, saveSnapshot } from './storage';
import type { CachedProduct, CommunityPriceSubmission, PriceSnapshot } from './types';

const COMMUNITY_PRICE_MAX_AGE_DAYS = 14;
const MAX_DAILY_REPORTS = 20;
const KNOWN_STORES = new Map([
  ['loblaws-hfx', { store: 'Loblaws', address: '5840 Almon St, Halifax, NS', coordinates: { lat: 44.6604, lng: -63.6115 } }],
  ['nofrills-hfx', { store: 'No Frills', address: '3601 Joseph Howe Dr, Halifax, NS', coordinates: { lat: 44.6528, lng: -63.6268 } }],
  ['rcss-hfx', { store: 'Real Canadian Superstore', address: '6141 Young St, Halifax, NS', coordinates: { lat: 44.6577, lng: -63.6103 } }],
  ['walmart-hfx', { store: 'Walmart', address: '6990 Mumford Rd, Halifax, NS', coordinates: { lat: 44.6483, lng: -63.6204 } }],
]);

export class CommunitySubmissionError extends Error {
  constructor(message: string, readonly status: 400 | 429 = 400) {
    super(message);
  }
}

export async function saveCommunityPrice(
  request: Request,
  env: Env,
  value: unknown,
): Promise<{ report_id: string; expires_at: string }> {
  const report = validateCommunitySubmission(value);
  await enforceRateLimit(request, env);

  const region = regionFromPostalCode(report.postal_code, env.DEFAULT_REGION);
  const snapshot = await loadSnapshot(env, region);
  const store = KNOWN_STORES.get(report.store_id);
  if (!store || store.store !== report.store) {
    throw new CommunitySubmissionError('Choose one of the supported stores.');
  }

  const reportId = crypto.randomUUID();
  const observedAt = new Date(`${report.observed_at}T00:00:00.000Z`);
  const expiresAt = new Date(
    observedAt.getTime() + COMMUNITY_PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const communityProduct: CachedProduct = {
    id: `community-${reportId}`,
    store_id: report.store_id,
    store: store.store,
    name: report.product_name,
    aliases: [report.product_name],
    brand: null,
    price: report.price,
    was_price: null,
    unit: report.unit,
    image: null,
    link: null,
    source: 'Community report',
    source_kind: 'community',
    observed_at: report.observed_at,
    attribution_url: null,
    valid_until: expiresAt.toISOString().slice(0, 10),
    address: store.address,
    coordinates: store.coordinates,
  };

  // Keep the newest report for the same store and normalized product name.
  const identity = communityIdentity(communityProduct);
  const products = snapshot.products.filter((product) =>
    product.source_kind !== 'community' || communityIdentity(product) !== identity
  );
  products.push(communityProduct);
  await saveSnapshot(env, {
    ...snapshot,
    generated_at: new Date().toISOString(),
    products,
    provider_status: [
      ...snapshot.provider_status.filter((status) => status.provider !== 'community-reports'),
      { provider: 'community-reports', success: true, error: null },
    ],
  });

  return { report_id: reportId, expires_at: expiresAt.toISOString() };
}

export function validateCommunitySubmission(value: unknown): CommunityPriceSubmission {
  if (!isRecord(value)) {
    throw new CommunitySubmissionError('Price report must be an object.');
  }
  // A hidden website field catches basic automated form spam without collecting
  // any personal information from real contributors.
  if (typeof value.website === 'string' && value.website.trim()) {
    throw new CommunitySubmissionError('Price report rejected.');
  }
  const productName = cleanText(value.product_name, 100);
  const storeId = cleanText(value.store_id, 60);
  const store = cleanText(value.store, 100);
  const unit = value.unit == null || value.unit === '' ? null : cleanText(value.unit, 40);
  const postalCode = normalizePostalCode(cleanText(value.postal_code, 10));
  const observedAt = cleanText(value.observed_at, 10);
  const price = typeof value.price === 'number' ? value.price : Number(value.price);
  const observationTime = Date.parse(`${observedAt}T00:00:00.000Z`);
  const now = Date.now();
  const earliest = now - COMMUNITY_PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(price) || price <= 0 || price > 1_000) {
    throw new CommunitySubmissionError('Price must be between $0.01 and $1,000.');
  }
  if (!Number.isFinite(observationTime) || observationTime > now || observationTime < earliest) {
    throw new CommunitySubmissionError('Observation date must be within the last 14 days.');
  }
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postalCode)) {
    throw new CommunitySubmissionError('Enter a valid Canadian postal code.');
  }

  return {
    product_name: productName,
    store_id: storeId,
    store,
    price: Math.round(price * 100) / 100,
    unit,
    observed_at: observedAt,
    postal_code: postalCode,
    website: '',
  };
}

async function enforceRateLimit(request: Request, env: Env): Promise<void> {
  const ipAddress = request.headers.get('CF-Connecting-IP') ?? 'local-development';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${ipAddress}`));
  const anonymousId = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const key = `community-rate:${day}:${anonymousId}`;
  const currentCount = Number(await env.PRICE_SNAPSHOTS.get(key) ?? '0');
  if (currentCount >= MAX_DAILY_REPORTS) {
    throw new CommunitySubmissionError('Daily community report limit reached.', 429);
  }
  await env.PRICE_SNAPSHOTS.put(key, String(currentCount + 1), { expirationTtl: 2 * 24 * 60 * 60 });
}

function communityIdentity(product: CachedProduct): string {
  return `${product.store_id}:${product.name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new CommunitySubmissionError('Required text field is missing.');
  }
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > maxLength) {
    throw new CommunitySubmissionError(`Text fields must contain 1 to ${maxLength} characters.`);
  }
  return cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
