/**
 * Shared CORS configuration for the public REST API.
 *
 * Instead of hardcoding `Access-Control-Allow-Origin: *` in every route,
 * this module reads a comma-separated allowlist from the
 * `ALLOWED_API_ORIGINS` environment variable.
 *
 * If the variable is not set, all origins are **blocked** by default
 * (deny-by-default).  Set it to `*` explicitly during development if
 * you need a permissive policy.
 *
 * Usage:
 *   import { getCorsHeaders, handlePreflight } from "@/lib/cors";
 *
 *   export function OPTIONS(request: NextRequest) {
 *     return handlePreflight(request);
 *   }
 *
 *   // In GET / POST handlers:
 *   return NextResponse.json(payload, { headers: getCorsHeaders(request) });
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Parse the allowed origins from the environment once.
 * Returns `null` when the env var is unset (= deny all cross-origin).
 * Returns `["*"]` when set to `*` (= allow any origin, dev only).
 * Otherwise returns an array of explicit origins.
 */
// MED-01: Memoize the parsed result to avoid re-parsing the env var
// on every request in high-traffic edge runtimes.
// NOTE: This cache is intentionally never invalidated. In production the
// env var is set once at deploy time and doesn't change. In development
// you can call `resetCorsCache()` (exported below) after changing the var.
let _parsedOrigins: string[] | null | undefined;
function parseAllowedOrigins(): string[] | null {
  if (_parsedOrigins !== undefined) return _parsedOrigins;
  const raw = process.env.ALLOWED_API_ORIGINS;
  if (!raw) { _parsedOrigins = null; return null; }
  if (raw.trim() === "*") { _parsedOrigins = ["*"]; return _parsedOrigins; }
  _parsedOrigins = raw
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  return _parsedOrigins;
}

/**
 * Returns the appropriate `Access-Control-Allow-Origin` value for the
 * given request, based on the configured allowlist.
 */
function resolveOrigin(request: NextRequest): string | null {
  const allowed = parseAllowedOrigins();
  if (!allowed) return null; // deny all
  if (allowed.includes("*")) return "*";

  const requestOrigin = request.headers.get("origin")?.toLowerCase();
  if (requestOrigin && allowed.includes(requestOrigin)) {
    return requestOrigin;
  }
  return null;
}

/**
 * Build CORS response headers for a given request.
 * If the request origin is not allowed, the `Access-Control-Allow-Origin`
 * header is omitted entirely (browser will block the response).
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = resolveOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    // When returning a specific origin (not *), the Vary header is
    // required so caches don't serve the wrong CORS response.
    if (origin !== "*") {
      headers["Vary"] = "Origin";
    }
  }
  return headers;
}

/**
 * Handle an OPTIONS preflight request using the shared CORS config.
 */
export function handlePreflight(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Reset the cached parsed origins so the env var is re-read on the next
 * request. Useful in tests or when hot-reloading env vars in development.
 */
export function resetCorsCache(): void {
  _parsedOrigins = undefined;
}
