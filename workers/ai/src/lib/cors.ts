/**
 * CORS helpers for the AI Worker.
 *
 * The previous implementation reflected `url.origin` (the Worker's OWN host)
 * into `Access-Control-Allow-Origin`, and only attached CORS headers to the
 * preflight + error responses — never to the successful streaming response.
 * That worked by accident only for strictly same-origin calls and would block
 * any cross-subdomain browser caller (e.g. app.oltigo.com → oltigo.com).
 *
 * This module instead validates the REQUEST's `Origin` header against an
 * allowlist and echoes it back, and `withCors()` is applied to every response
 * (preflight, errors, and the success stream) from a single choke point in
 * index.ts. `Access-Control-Allow-Credentials: true` is required because the
 * caller sends Supabase auth cookies, and a credentialed response may not use
 * the `*` wildcard — so we must echo a concrete, validated origin.
 */

// Production + any oltigo.com subdomain over HTTPS.
const OLTIGO_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*oltigo\.com$/i;
// Local development (`wrangler dev` / `next dev`). An attacker cannot forge an
// `Origin` header from a victim's browser, so allowing localhost is not a
// production risk — it only matches pages actually served from localhost.
const LOCALHOST_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * Return the request's Origin if it is allowed, otherwise null.
 */
export function resolveAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (OLTIGO_ORIGIN_RE.test(origin) || LOCALHOST_ORIGIN_RE.test(origin)) {
    return origin;
  }
  return null;
}

/**
 * Build CORS headers for an allowed origin. Returns an empty object when the
 * origin is missing or not allowed (so no CORS headers are emitted and the
 * browser correctly blocks the cross-origin read).
 */
export function corsHeaders(request: Request): Record<string, string> {
  const allowed = resolveAllowedOrigin(request);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
    // Caches must key on Origin since the ACAO value varies per request.
    Vary: "Origin",
  };
}

/**
 * Return a copy of `response` with CORS headers merged in. Preserves the
 * original body (including streaming bodies), status, and existing headers.
 */
export function withCors(response: Response, request: Request): Response {
  const extra = corsHeaders(request);
  if (Object.keys(extra).length === 0) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extra)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
