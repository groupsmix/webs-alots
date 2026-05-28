/**
 * API route validation wrappers.
 *
 * Provides higher-order functions that wrap API route handlers with
 * automatic Zod validation, error handling, and structured logging.
 *
 * @example Standalone route (no auth):
 *   import { withValidation } from "@/lib/api-validate";
 *   import { bookingCancelSchema } from "@/lib/validations";
 *
 *   export const POST = withValidation(bookingCancelSchema, async (data, request) => {
 *     // `data` is typed and validated
 *     return apiSuccess({ cancelled: true });
 *   });
 *
 * @example Authenticated route:
 *   import { withAuthValidation } from "@/lib/api-validate";
 *   import { bookingCancelSchema } from "@/lib/validations";
 *
 *   export const POST = withAuthValidation(bookingCancelSchema, async (data, request, auth) => {
 *     // `data` is typed and validated, `auth` has supabase/user/profile
 *     return apiSuccess({ cancelled: true });
 *   }, ["clinic_admin", "doctor"]);
 */

import { type NextRequest, NextResponse } from "next/server";
import { type ZodType } from "zod";
import { apiValidationError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import { safeParse } from "@/lib/validations";
import { withAuth, withAuthAnyRole, type AuthContext } from "@/lib/with-auth";

/**
 * Wrap an API route handler with Zod request body validation.
 *
 * - Parses the JSON body with the given schema
 * - Returns a 422 with a descriptive message on validation failure
 * - Catches unhandled errors and returns a 500
 * - Logs errors with structured context
 */
/** IV-002: Maximum request body size (64 KB) to prevent oversized JSON payloads. */
const MAX_BODY_BYTES = 65_536;

/**
 * W8-I-01: Stream-read the request body with a byte cap. Works even when the
 * client omits Content-Length (chunked transfer encoding). Returns the decoded
 * text or null if the body exceeds the cap.
 */
async function readBodyCapped(request: NextRequest, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* best effort */
      }
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export function withValidation<T>(
  schema: ZodType<T>,
  handler: (data: T, request: NextRequest) => Promise<NextResponse | Response>,
): (request: NextRequest) => Promise<NextResponse | Response> {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    // IV-002: Fail-fast if Content-Length exceeds cap
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return apiValidationError(`Request body too large (max ${MAX_BODY_BYTES} bytes)`);
    }

    // W8-I-01: Stream-read body with byte cap for chunked requests
    let body: unknown;
    try {
      const text = await readBodyCapped(request, MAX_BODY_BYTES);
      if (text === null) {
        return apiValidationError(`Request body too large (max ${MAX_BODY_BYTES} bytes)`);
      }
      body = JSON.parse(text);
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const result = safeParse(schema, body);
    if (!result.success) {
      return apiValidationError(result.error);
    }

    try {
      return await handler(result.data, request);
    } catch (err) {
      logger.error("Unhandled API route error", {
        context: `api${request.nextUrl.pathname}`,
        error: err,
      });
      return apiInternalError();
    }
  };
}

/**
 * Wrap an authenticated API route handler with Zod request body validation.
 *
 * Combines `withAuth` (authentication + role checking) with `withValidation`
 * (JSON body parsing + Zod schema validation) in a single wrapper.
 *
 * - Authenticates the user and checks role permissions (via withAuth)
 * - Parses the JSON body with the given schema
 * - Returns a 422 with a descriptive message on validation failure
 * - Catches unhandled errors and returns a 500
 * - Logs errors with structured context
 */
export function withAuthValidation<T>(
  schema: ZodType<T>,
  handler: (data: T, request: NextRequest, auth: AuthContext) => Promise<NextResponse>,
  allowedRoles: UserRole[] | null,
): (request: NextRequest) => Promise<NextResponse> {
  const inner = async (request: NextRequest, auth: AuthContext) => {
    // IV-002: Fail-fast if Content-Length exceeds cap
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return apiValidationError(`Request body too large (max ${MAX_BODY_BYTES} bytes)`);
    }

    // W8-I-01: Stream-read body with byte cap for chunked requests
    let body: unknown;
    try {
      const text = await readBodyCapped(request, MAX_BODY_BYTES);
      if (text === null) {
        return apiValidationError(`Request body too large (max ${MAX_BODY_BYTES} bytes)`);
      }
      body = JSON.parse(text);
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const result = safeParse(schema, body);
    if (!result.success) {
      return apiValidationError(result.error);
    }

    try {
      return await handler(result.data, request, auth);
    } catch (err) {
      logger.error("Unhandled API route error", {
        context: `api${request.nextUrl.pathname}`,
        error: err,
      });
      return apiInternalError();
    }
  };

  // R-04: withAuth no longer accepts null. Use withAuthAnyRole when callers
  // pass null to preserve the "any authenticated user" behavior.
  return allowedRoles === null ? withAuthAnyRole(inner) : withAuth(inner, allowedRoles);
}
