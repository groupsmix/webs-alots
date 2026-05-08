/**
 * Standardized API response helpers.
 *
 * All API routes should use these helpers to ensure consistent response
 * shapes across the application:
 *
 *   Success: { ok: true, data: T }
 *   Error:   { ok: false, error: string, code?: string }
 *
 * @example
 *   import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
 *
 *   // Success
 *   return apiSuccess({ appointment });
 *
 *   // Client error
 *   return apiError("Appointment not found", 404, "NOT_FOUND");
 *
 *   // Validation error (from Zod safeParse)
 *   return apiValidationError("date: Expected YYYY-MM-DD");
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}

interface ApiErrorBody {
  ok: false;
  error: string;
  code?: string;
}

/**
 * Return a success JSON response with standard shape.
 */
export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ ok: true as const, data }, { status, headers });
}

/**
 * Return an error JSON response with standard shape.
 */
export function apiError(
  error: string,
  status = 400,
  code?: string,
  headers?: HeadersInit,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { ok: false, error };
  if (code) body.code = code;
  return NextResponse.json(body, { status, headers });
}

/**
 * Return a 422 validation error response.
 * Designed to pair with the `safeParse` helper from `@/lib/validations`.
 */
export function apiValidationError(message: string): NextResponse<ApiErrorBody> {
  return apiError(message, 422, "VALIDATION_ERROR");
}

/**
 * Return a 401 unauthorized error response.
 */
export function apiUnauthorized(message = "Authentication required"): NextResponse<ApiErrorBody> {
  return apiError(message, 401, "UNAUTHORIZED");
}

/**
 * Return a 403 forbidden error response.
 */
export function apiForbidden(message = "Insufficient permissions"): NextResponse<ApiErrorBody> {
  return apiError(message, 403, "FORBIDDEN");
}

/**
 * Return a 404 not found error response.
 */
export function apiNotFound(message = "Resource not found"): NextResponse<ApiErrorBody> {
  return apiError(message, 404, "NOT_FOUND");
}

/**
 * Return a 429 rate limit error response.
 */
export function apiRateLimited(message = "Too many requests. Please try again later."): NextResponse<ApiErrorBody> {
  return apiError(message, 429, "RATE_LIMITED");
}

/**
 * Return a 500 internal server error response.
 * Never expose internal details to the client.
 */
export function apiInternalError(message = "Internal server error"): NextResponse<ApiErrorBody> {
  return apiError(message, 500, "INTERNAL_ERROR");
}

/**
 * Handle a Supabase PostgREST error by logging it and returning a 500 response.
 *
 * Consolidates the repeated `if (error) { logger.warn(...); return apiInternalError(...); }`
 * pattern found across API routes.  Routes can adopt this incrementally:
 *
 * @example
 *   const { data, error } = await supabase.from("patients").select();
 *   if (error) return handleSupabaseError(error, "Failed to fetch patients", "patients");
 */
// F-A93-03: Use logger.error for actual database failures, not logger.warn
export function handleSupabaseError(
  error: { message: string; code?: string; details?: string },
  clientMessage: string,
  context: string,
): NextResponse<ApiErrorBody> {
  logger.error(clientMessage, { context, error });
  return apiInternalError(clientMessage);
}

/**
 * Map a Supabase PostgREST error to the appropriate HTTP status and return
 * a standardized API error response.
 *
 * Unlike `handleSupabaseError` (which always returns 500), this function
 * inspects the PostgreSQL error code to return semantically correct statuses:
 *
 *   - `23505` (unique_violation) → 409 Conflict
 *   - `PGRST116` (row not found / single-row expected) → 404 Not Found
 *   - Everything else → 500 Internal Server Error
 *
 * @example
 *   const { data, error } = await supabase.from("clinics").insert(row);
 *   if (error) return apiSupabaseError(error, "clinics/create");
 */
export function apiSupabaseError(
  error: { message: string; code?: string; details?: string },
  context: string,
): NextResponse<ApiErrorBody> {
  // F-A93-03: Database errors are errors, not warnings
  logger.error("Supabase error", { context, error });

  switch (error.code) {
    case "23505":
      return apiError("Resource already exists", 409, "CONFLICT");
    case "PGRST116":
      return apiNotFound();
    default:
      return apiInternalError();
  }
}
