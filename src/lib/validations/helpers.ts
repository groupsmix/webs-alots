import { z } from "zod";

/**
 * Parse a value with a Zod schema and return the parsed data or a
 * formatted error message suitable for an API response.
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // A8-01: Redact field paths from client-facing errors to prevent
  // information disclosure (schema shape, field names, constraints).
  const count = result.error.issues.length;
  return {
    success: false,
    error: `Validation error: ${count} field${count !== 1 ? "s" : ""} invalid`,
  };
}
