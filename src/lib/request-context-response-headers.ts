import { type NextRequest, NextResponse } from "next/server";

const INTERNAL_RATE_LIMIT_REQUEST_HEADERS = {
  limit: "x-oltigo-ratelimit-limit",
  remaining: "x-oltigo-ratelimit-remaining",
  reset: "x-oltigo-ratelimit-reset",
} as const;

const STANDARD_RATE_LIMIT_RESPONSE_HEADERS = {
  limit: "X-RateLimit-Limit",
  remaining: "X-RateLimit-Remaining",
  reset: "X-RateLimit-Reset",
} as const;

export interface RateLimitHeaderValues {
  limit: number;
  remaining: number;
  reset: number;
}

export function clearInternalRateLimitRequestHeaders(headers: Headers): void {
  headers.delete(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.limit);
  headers.delete(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.remaining);
  headers.delete(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.reset);
}

export function setInternalRateLimitRequestHeaders(
  headers: Headers,
  values: RateLimitHeaderValues,
): void {
  headers.set(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.limit, String(values.limit));
  headers.set(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.remaining, String(values.remaining));
  headers.set(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.reset, String(values.reset));
}

export function applyRequestScopedResponseHeaders(
  request: Pick<NextRequest, "headers">,
  response: NextResponse,
): NextResponse {
  const limit = request.headers.get(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.limit);
  const remaining = request.headers.get(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.remaining);
  const reset = request.headers.get(INTERNAL_RATE_LIMIT_REQUEST_HEADERS.reset);

  if (limit && !response.headers.has(STANDARD_RATE_LIMIT_RESPONSE_HEADERS.limit)) {
    response.headers.set(STANDARD_RATE_LIMIT_RESPONSE_HEADERS.limit, limit);
  }
  if (remaining && !response.headers.has(STANDARD_RATE_LIMIT_RESPONSE_HEADERS.remaining)) {
    response.headers.set(STANDARD_RATE_LIMIT_RESPONSE_HEADERS.remaining, remaining);
  }
  if (reset && !response.headers.has(STANDARD_RATE_LIMIT_RESPONSE_HEADERS.reset)) {
    response.headers.set(STANDARD_RATE_LIMIT_RESPONSE_HEADERS.reset, reset);
  }

  return response;
}
