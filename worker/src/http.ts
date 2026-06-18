import type { ApiEnvelope } from './types';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function jsonResponse<T>(
  request: Request,
  env: Env,
  data: T,
  status = 200,
): Response {
  const payload: ApiEnvelope<T> = {
    success: status < 400,
    data: status < 400 ? data : null,
    error: null,
  };
  return Response.json(
    payload,
    { status, headers: corsHeaders(request, env) },
  );
}

export function errorResponse(
  request: Request,
  env: Env,
  message: string,
  status: number,
): Response {
  const payload: ApiEnvelope<never> = { success: false, data: null, error: message };
  return Response.json(
    payload,
    { status, headers: corsHeaders(request, env) },
  );
}

export function optionsResponse(request: Request, env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function readUploadJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    throw new Error('Upload exceeds the 5 MiB limit.');
  }
  if (!request.body) {
    throw new Error('Request body is required.');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw new Error('Upload exceeds the 5 MiB limit.');
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

export async function isAuthorized(request: Request, expectedToken: string | undefined): Promise<boolean> {
  if (!expectedToken) {
    return false;
  }
  const authorization = request.headers.get('authorization');
  const suppliedToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!suppliedToken) {
    return false;
  }

  // Web Crypto verification avoids direct secret-string comparison.
  const encoder = new TextEncoder();
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const expectedKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(expectedToken),
    algorithm,
    false,
    ['verify'],
  );
  const suppliedKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(suppliedToken),
    algorithm,
    false,
    ['sign'],
  );
  const message = encoder.encode('grocery-deals-api-ingest');
  const suppliedSignature = await crypto.subtle.sign(algorithm, suppliedKey, message);
  return crypto.subtle.verify(algorithm, expectedKey, suppliedSignature, message);
}

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('origin');
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
  const allowOrigin = origin && isAllowedOrigin(origin, allowedOrigins) ? origin : allowedOrigins[0] ?? '';
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  });
  if (allowOrigin) {
    headers.set('Access-Control-Allow-Origin', allowOrigin);
  }
  return headers;
}

function isAllowedOrigin(origin: string, configuredOrigins: string[]): boolean {
  if (configuredOrigins.includes(origin)) {
    return true;
  }
  try {
    const url = new URL(origin);
    return (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}
