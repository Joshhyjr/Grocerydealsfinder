import {
  basketSnapshot,
  isSnapshotStale,
  normalizePostalCode,
  regionFromPostalCode,
  searchSnapshot,
} from './domain';
import {
  errorResponse,
  isAuthorized,
  jsonResponse,
  optionsResponse,
  readUploadJson,
} from './http';
import { CommunitySubmissionError, saveCommunityPrice } from './community';
import { refreshProviderSnapshots, snapshotFromUpload } from './providers';
import { loadSnapshot, saveSnapshot } from './storage';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return optionsResponse(request, env);
    }

    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        const region = url.searchParams.get('region') || env.DEFAULT_REGION;
        const snapshot = await loadSnapshot(env, region, ctx);
        return jsonResponse(request, env, {
          status: 'ok',
          region,
          data_source: snapshot.data_source,
          generated_at: snapshot.generated_at,
          expires_at: snapshot.expires_at,
          stale: isSnapshotStale(snapshot),
          product_count: snapshot.products.length,
          provider_status: snapshot.provider_status,
        });
      }

      if (request.method === 'GET' && url.pathname === '/search') {
        const query = url.searchParams.get('q')?.trim() ?? '';
        const postalCode = normalizePostalCode(url.searchParams.get('postal_code') ?? '');
        if (!query || !postalCode) {
          return errorResponse(request, env, 'q and postal_code are required.', 400);
        }
        const region = regionFromPostalCode(postalCode, env.DEFAULT_REGION);
        const snapshot = await loadSnapshot(env, region, ctx);
        return jsonResponse(request, env, searchSnapshot(snapshot, query, postalCode));
      }

      if (request.method === 'GET' && url.pathname === '/basket') {
        const items = (url.searchParams.get('items') ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 50);
        const postalCode = normalizePostalCode(url.searchParams.get('postal_code') ?? '');
        if (items.length === 0 || !postalCode) {
          return errorResponse(request, env, 'items and postal_code are required.', 400);
        }
        const region = regionFromPostalCode(postalCode, env.DEFAULT_REGION);
        const snapshot = await loadSnapshot(env, region, ctx);
        return jsonResponse(request, env, basketSnapshot(snapshot, items, postalCode));
      }

      if (request.method === 'POST' && url.pathname === '/community/prices') {
        try {
          const body = await readUploadJson(request);
          const result = await saveCommunityPrice(request, env, body);
          return jsonResponse(request, env, {
            ...result,
            message: 'Thanks — the anonymous community price is now available for up to 14 days.',
          }, 201);
        } catch (error) {
          if (error instanceof CommunitySubmissionError) {
            return errorResponse(request, env, error.message, error.status);
          }
          throw error;
        }
      }

      if (request.method === 'POST' && url.pathname === '/admin/snapshots') {
        if (!await isAuthorized(request, env.INGEST_TOKEN)) {
          return errorResponse(request, env, 'Unauthorized.', 401);
        }
        const body = await readUploadJson(request);
        const snapshot = snapshotFromUpload(body, env.SNAPSHOT_MAX_AGE_SECONDS);
        await saveSnapshot(env, snapshot);
        return jsonResponse(request, env, {
          stored: true,
          region: snapshot.region,
          generated_at: snapshot.generated_at,
          product_count: snapshot.products.length,
        }, 201);
      }

      if (request.method === 'POST' && url.pathname === '/admin/refresh') {
        if (!await isAuthorized(request, env.INGEST_TOKEN)) {
          return errorResponse(request, env, 'Unauthorized.', 401);
        }
        const snapshots = await refreshProviderSnapshots(env);
        return jsonResponse(request, env, {
          refreshed_regions: snapshots.map((snapshot) => snapshot.region),
          product_count: snapshots.reduce((total, snapshot) => total + snapshot.products.length, 0),
        });
      }

      return errorResponse(request, env, 'Not found.', 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected API error.';
      console.error(JSON.stringify({
        message: 'request failed',
        method: request.method,
        path: url.pathname,
        error: message,
      }));
      return errorResponse(request, env, message, 500);
    }
  },

  async scheduled(controller, env, ctx): Promise<void> {
    // Scheduled refreshes run outside the user request path and preserve the
    // previous KV snapshot automatically when every provider fails.
    ctx.waitUntil(
      refreshProviderSnapshots(env).catch((error) => {
        console.error(JSON.stringify({
          message: 'scheduled provider refresh failed',
          cron: controller.cron,
          error: error instanceof Error ? error.message : String(error),
        }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
