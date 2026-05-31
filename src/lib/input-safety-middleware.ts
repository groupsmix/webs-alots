/**
 * A62-C1 / A62-C2 / A62-C3: Input safety middleware.
 *
 * Enforces input limits at the middleware layer so bad requests fail fast
 * before reaching route handlers. This reduces log volume and prevents
 * downstream processing of suspicious requests.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  PAGINATION_LIMITS,
  QUERY_STRING_LIMITS,
  TOKEN_LIMITS,
  validateQueryStringLength,
  extractBearerToken,
} from "@/lib/input-safety";
import { logger } from "@/lib/logger";

/**
 * A62-C1 / A62-C3: Check pagination and auth headers for safety violations.
 * If a violation is detected, log it and return a 400 error.
 *
 * Call this early in your API middleware or individual route handlers.
 */
export async function checkInputSafety(request: NextRequest): Promise<NextResponse | null> {
  // A62-C1: Check query string length
  const queryString = request.nextUrl.search;
  if (queryString) {
    const err = validateQueryStringLength(queryString);
    if (err) {
      logger.warn("input-safety: query string too long", {
        context: "input-safety-middleware",
        path: request.nextUrl.pathname,
        queryLength: queryString.length,
        limit: QUERY_STRING_LIMITS.MAX_LENGTH,
      });
      return NextResponse.json(
        { error: "Invalid request: query string too long", code: "QUERY_STRING_TOO_LONG" },
        { status: 400 },
      );
    }
  }

  // A62-C3: Check Authorization header length
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    if (authHeader.length > 100 + TOKEN_LIMITS.MAX_TOKEN_LENGTH) {
      logger.warn("input-safety: auth header too long", {
        context: "input-safety-middleware",
        path: request.nextUrl.pathname,
        authLength: authHeader.length,
      });
      return NextResponse.json(
        { error: "Invalid request: authorization header too long", code: "AUTH_HEADER_TOO_LONG" },
        { status: 400 },
      );
    }

    // A62-C3: Validate bearer token format
    const token = extractBearerToken(authHeader);
    if (authHeader.includes("Bearer ") && !token) {
      logger.warn("input-safety: invalid bearer token", {
        context: "input-safety-middleware",
        path: request.nextUrl.pathname,
      });
      return NextResponse.json(
        { error: "Invalid authorization token", code: "INVALID_BEARER_TOKEN" },
        { status: 401 },
      );
    }
  }

  // A62-C1: Check pagination parameters if present in query
  const offsetParam = request.nextUrl.searchParams.get("offset");
  const limitParam = request.nextUrl.searchParams.get("limit");

  if (offsetParam || limitParam) {
    try {
      const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
      const limit = limitParam ? parseInt(limitParam, 10) : PAGINATION_LIMITS.DEFAULT_LIMIT;

      if (isNaN(offset) || isNaN(limit)) {
        return NextResponse.json(
          { error: "Invalid pagination parameters", code: "INVALID_PAGINATION" },
          { status: 400 },
        );
      }

      if (offset < 0 || offset > PAGINATION_LIMITS.MAX_OFFSET) {
        logger.warn("input-safety: offset out of range", {
          context: "input-safety-middleware",
          path: request.nextUrl.pathname,
          offset,
          max: PAGINATION_LIMITS.MAX_OFFSET,
        });
        return NextResponse.json(
          {
            error: `Offset must be between 0 and ${PAGINATION_LIMITS.MAX_OFFSET}`,
            code: "OFFSET_OUT_OF_RANGE",
          },
          { status: 400 },
        );
      }

      if (limit < PAGINATION_LIMITS.MIN_LIMIT || limit > PAGINATION_LIMITS.MAX_LIMIT) {
        logger.warn("input-safety: limit out of range", {
          context: "input-safety-middleware",
          path: request.nextUrl.pathname,
          limit,
          min: PAGINATION_LIMITS.MIN_LIMIT,
          max: PAGINATION_LIMITS.MAX_LIMIT,
        });
        return NextResponse.json(
          {
            error: `Limit must be between ${PAGINATION_LIMITS.MIN_LIMIT} and ${PAGINATION_LIMITS.MAX_LIMIT}`,
            code: "LIMIT_OUT_OF_RANGE",
          },
          { status: 400 },
        );
      }
    } catch (err) {
      logger.warn("input-safety: error parsing pagination params", {
        context: "input-safety-middleware",
        path: request.nextUrl.pathname,
        error: err,
      });
      return NextResponse.json(
        { error: "Invalid pagination parameters", code: "INVALID_PAGINATION" },
        { status: 400 },
      );
    }
  }

  // No violations detected
  return null;
}
