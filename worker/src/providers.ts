import { validateSnapshot } from './domain';
import { fetchOpenPricesSnapshot } from './open-prices';
import { loadSnapshot, saveSnapshot } from './storage';
import type { CachedProduct, PriceSnapshot, ProviderPayload } from './types';

const MAX_PROVIDER_BYTES = 5 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 12_000;

export async function refreshProviderSnapshots(env: Env): Promise<PriceSnapshot[]> {
  const urls = env.PROVIDER_FEED_URLS
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  // Open Prices is an openly licensed source and is always attempted. Empty
  // Halifax coverage is treated as a normal result rather than a provider error.
  const openPrices = await fetchOpenPricesSnapshot(env).catch((error) => {
    console.error(JSON.stringify({
      message: 'Open Prices refresh failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  });
  const results = await Promise.allSettled(urls.map((url) => fetchProvider(url, env.PROVIDER_API_TOKEN)));
  const successfulPayloads = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (openPrices) {
    successfulPayloads.push(openPrices);
  }
  const failures = results.flatMap((result, index) => result.status === 'rejected'
    ? [{
        provider: safeProviderName(urls[index]),
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }]
    : []);

  if (successfulPayloads.length === 0 && urls.length > 0) {
    throw new Error(`All ${urls.length} provider feeds failed.`);
  }
  if (successfulPayloads.length === 0) {
    console.log(JSON.stringify({ message: 'provider refresh completed', reason: 'no fresh open data found' }));
    return [];
  }

  const byRegion = new Map<string, ProviderPayload[]>();
  for (const payload of successfulPayloads) {
    const existing = byRegion.get(payload.region) ?? [];
    existing.push(payload);
    byRegion.set(payload.region, existing);
  }

  const snapshots: PriceSnapshot[] = [];
  for (const [region, payloads] of byRegion) {
    const existingSnapshot = await loadSnapshot(env, region);
    const snapshot = mergeProviderPayloads(
      region,
      existingSnapshot,
      payloads,
      failures,
      env.SNAPSHOT_MAX_AGE_SECONDS,
    );
    await saveSnapshot(env, snapshot);
    snapshots.push(snapshot);
  }

  console.log(JSON.stringify({
    message: 'provider refresh completed',
    regions: snapshots.map((snapshot) => snapshot.region),
    products: snapshots.reduce((total, snapshot) => total + snapshot.products.length, 0),
    failures: failures.length,
  }));
  return snapshots;
}

export function snapshotFromUpload(value: unknown, maxAgeSeconds: string): PriceSnapshot {
  if (!isRecord(value) || !Array.isArray(value.products) || typeof value.region !== 'string') {
    throw new Error('Upload must contain a region and products array.');
  }

  const now = new Date();
  const maxAge = parsePositiveInteger(maxAgeSeconds, 21_600);
  return validateSnapshot({
    schema_version: 1,
    region: value.region,
    generated_at: typeof value.generated_at === 'string' ? value.generated_at : now.toISOString(),
    expires_at: typeof value.expires_at === 'string'
      ? value.expires_at
      : new Date(now.getTime() + maxAge * 1000).toISOString(),
    data_source: value.data_source === 'estimate' ? 'estimate' : 'live',
    provider_status: Array.isArray(value.provider_status)
      ? value.provider_status
      : [{ provider: 'authenticated-upload', success: true, error: null }],
    products: value.products,
  });
}

function mergeProviderPayloads(
  region: string,
  existingSnapshot: PriceSnapshot,
  payloads: ProviderPayload[],
  failures: PriceSnapshot['provider_status'],
  maxAgeSeconds: string,
): PriceSnapshot {
  const now = new Date();
  const maxAge = parsePositiveInteger(maxAgeSeconds, 21_600);
  // Preserve community reports and estimate coverage while replacing matching
  // products with fresher open or licensed provider observations.
  const products = deduplicateProducts([
    ...existingSnapshot.products,
    ...payloads.flatMap((payload) => payload.products),
  ]);

  return validateSnapshot({
    schema_version: 1,
    region,
    generated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + maxAge * 1000).toISOString(),
    data_source: products.some((product) => product.source_kind === 'estimate') ? 'estimate' : 'live',
    provider_status: [
      ...existingSnapshot.provider_status.filter((status) =>
        !payloads.some((payload) => payload.products[0]?.source === status.provider)
      ),
      ...payloads.map((payload) => ({
        provider: payload.products[0]?.source ?? 'provider-feed',
        success: true,
        error: null,
      })),
      ...failures,
    ],
    products,
  });
}

async function fetchProvider(url: string, token: string | undefined): Promise<ProviderPayload> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Provider returned status ${response.status}.`);
    }

    const value = await readBoundedJson(response, MAX_PROVIDER_BYTES);
    if (!isRecord(value) || typeof value.region !== 'string' || !Array.isArray(value.products)) {
      throw new Error('Provider response must contain region and products.');
    }

    // Reuse full snapshot validation to reject malformed provider products.
    const snapshot = snapshotFromUpload({ ...value, data_source: 'live' }, '21600');
    return {
      region: snapshot.region,
      generated_at: snapshot.generated_at,
      expires_at: snapshot.expires_at,
      products: snapshot.products,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function deduplicateProducts(products: CachedProduct[]): CachedProduct[] {
  const byIdentity = new Map<string, CachedProduct>();
  for (const product of products) {
    const key = `${product.store_id}:${product.id}`;
    const current = byIdentity.get(key);
    if (!current || product.price < current.price) {
      byIdentity.set(key, product);
    }
  }
  return [...byIdentity.values()];
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    throw new Error(`Provider payload exceeds ${maxBytes} bytes.`);
  }
  if (!response.body) {
    throw new Error('Provider returned an empty response.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Provider payload exceeds ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(combined));
}

function safeProviderName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'provider-feed';
  }
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
