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
import { withAuth, type AuthContext } from "@/lib/with-auth";

/**
 * Wrap an API route handler with Zod request body validation.
 *
 * - Parses the JSON body with the given schema
 * - Returns a 422 with a descriptive message on validation failure
 * - Catches unhandled errors and returns a 500
 * - Logs errors with structured context
 */
export function withValidation<T>(
  schema: ZodType<T>,
  handler: (data: T, request: NextRequest) => Promise<NextResponse | Response>,
): (request: NextRequest) => Promise<NextResponse | Response> {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    let body: unknown;
    try {
      body = await request.json();
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
  return withAuth(async (request: NextRequest, auth: AuthContext) => {
    let body: unknown;
    try {
      body = await request.json();
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
  }, allowedRoles);
}
