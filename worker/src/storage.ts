import { createSeedSnapshot } from './seed';
import { removeExpiredOpenData, validateSnapshot } from './domain';
import type { PriceSnapshot } from './types';

const SNAPSHOT_KEY_PREFIX = 'snapshot:';

export async function loadSnapshot(
  env: Env,
  region: string,
  ctx?: ExecutionContext,
): Promise<PriceSnapshot> {
  const stored = await env.PRICE_SNAPSHOTS.get(`${SNAPSHOT_KEY_PREFIX}${region}`, 'json');

  if (stored) {
    try {
      const snapshot = removeExpiredOpenData(validateSnapshot(stored));
      if (shouldRenewEstimateSnapshot(snapshot)) {
        // Static estimates do not become more accurate with age, but renewing
        // their cache window prevents the UI from presenting them as failed live data.
        const renewedSnapshot = renewEstimateSnapshot(snapshot);
        ctx?.waitUntil(saveSnapshot(env, renewedSnapshot));
        return renewedSnapshot;
      }
      return snapshot;
    } catch (error) {
      console.error(JSON.stringify({
        message: 'invalid cached snapshot',
        region,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  const seed = createSeedSnapshot();
  // Seed persistence is non-critical and should not delay the first response.
  ctx?.waitUntil(saveSnapshot(env, seed));
  return seed;
}

export async function saveSnapshot(env: Env, snapshot: PriceSnapshot): Promise<void> {
  const validated = validateSnapshot(snapshot);
  await env.PRICE_SNAPSHOTS.put(
    `${SNAPSHOT_KEY_PREFIX}${validated.region}`,
    JSON.stringify(validated),
    {
      metadata: {
        generated_at: validated.generated_at,
        data_source: validated.data_source,
        product_count: validated.products.length,
      },
    },
  );
}

function shouldRenewEstimateSnapshot(snapshot: PriceSnapshot, now = new Date()): boolean {
  // Only seed/community estimate snapshots are renewable. A stale provider
  // snapshot must remain visibly stale until its upstream feed succeeds again.
  return Date.parse(snapshot.expires_at) <= now.getTime()
    && snapshot.data_source === 'estimate'
    && snapshot.products.every((product) =>
      product.source_kind === 'estimate' || product.source_kind === 'community'
    );
}

function renewEstimateSnapshot(snapshot: PriceSnapshot, now = new Date()): PriceSnapshot {
  return {
    ...snapshot,
    generated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
  };
}
