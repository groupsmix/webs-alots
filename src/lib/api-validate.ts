/**
 * API route validation wrapper.
 *
 * Provides a higher-order function that wraps API route handlers with
 * automatic Zod validation, error handling, and structured logging.
 *
 * @example
 *   import { withValidation } from "@/lib/api-validate";
 *   import { bookingCancelSchema } from "@/lib/validations";
 *
 *   export const POST = withValidation(bookingCancelSchema, async (data, request) => {
 *     // `data` is typed and validated
 *     return apiSuccess({ cancelled: true });
 *   });
 */

import { type NextRequest, NextResponse } from "next/server";
import { type ZodType } from "zod";
import { safeParse } from "@/lib/validations";
import { apiValidationError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

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
  handler: (data: T, request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
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
