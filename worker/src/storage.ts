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
      return removeExpiredOpenData(validateSnapshot(stored));
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
