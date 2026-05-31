/**
 * A62-C1 / A62-C2 / A62-C3: Input safety guardrails.
 *
 * A62-C1: Hard limits on pagination (offset, limit)
 * A62-C2: ReDoS prevention — validate regex patterns in user input
 * A62-C3: Token/secret cap — limit bearer token length to prevent abuse
 */

import { z } from "zod";

/**
 * A62-C1: Hard limits for pagination parameters.
 * Prevents accidental or malicious OFFSET/LIMIT abuses.
 */
export const PAGINATION_LIMITS = {
  /** Maximum offset for any query. Protects against O(N) full-table scans. */
  MAX_OFFSET: 100000,
  /** Maximum records to return per page. Prevents memory exhaustion. */
  MAX_LIMIT: 1000,
  /** Minimum page size to enforce (must fetch at least this many). */
  MIN_LIMIT: 1,
  /** Default page size if not specified. */
  DEFAULT_LIMIT: 50,
};

/**
 * A62-C1: Safe pagination input validator.
 * Rejects offset/limit pairs that exceed configured hard limits.
 */
export const safePaginationInput = z.object({
  offset: z.coerce
    .number()
    .int("Offset must be an integer")
    .gte(0, "Offset cannot be negative")
    .lte(PAGINATION_LIMITS.MAX_OFFSET, `Offset cannot exceed ${PAGINATION_LIMITS.MAX_OFFSET}`),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .gte(PAGINATION_LIMITS.MIN_LIMIT, `Limit must be at least ${PAGINATION_LIMITS.MIN_LIMIT}`)
    .lte(PAGINATION_LIMITS.MAX_LIMIT, `Limit cannot exceed ${PAGINATION_LIMITS.MAX_LIMIT}`)
    .default(PAGINATION_LIMITS.DEFAULT_LIMIT),
});

/**
 * A62-C2: ReDoS (Regular Expression Denial of Service) prevention.
 *
 * User-supplied regex patterns can cause catastrophic backtracking.
 * This validator enforces maximum pattern length and disallows known-dangerous constructs.
 */
export const REGEX_LIMITS = {
  /** Maximum regex pattern length. Longer patterns are suspicious. */
  MAX_LENGTH: 256,
  /** Dangerous regex constructs that may cause ReDoS. */
  FORBIDDEN_PATTERNS: [
    // Nested quantifiers: (a+)+, (a*)*  — cause exponential backtracking
    /\([^)]*[*+]{1,}[^)]*\)[*+]/,
    // Alternation with overlap: (a|a)*, (x|xa)* — ambiguous matching
    /\(.*\|.*\)[*+]/,
    // Unconstrained character classes: .*, .+
    /\.(?:[*+]|{[0-9,]+})/,
  ],
};

/**
 * A62-C2: Validate a user-supplied regex pattern.
 * Rejects patterns that are too long or contain known ReDoS constructs.
 * Returns null if safe, or an error message if unsafe.
 */
export function validateRegexPattern(pattern: string): string | null {
  if (pattern.length > REGEX_LIMITS.MAX_LENGTH) {
    return `Regex pattern too long (max ${REGEX_LIMITS.MAX_LENGTH} chars)`;
  }

  // Check for forbidden constructs
  for (const forbiddenRegex of REGEX_LIMITS.FORBIDDEN_PATTERNS) {
    if (forbiddenRegex.test(pattern)) {
      return "Regex pattern contains potentially unsafe constructs (nested quantifiers, alternation overlap)";
    }
  }

  // Try to compile the pattern — if it throws, reject
  try {
    new RegExp(pattern);
  } catch {
    return "Invalid regex pattern";
  }

  return null;
}

/**
 * A62-C3: Bearer token / secret length validation.
 * Prevents abusers from submitting extremely long bearer tokens that could
 * overflow buffers, logs, or cause DoS via token storage/lookup.
 */
export const TOKEN_LIMITS = {
  /** Typical JWT/OAuth tokens are 500-2000 bytes. Reject beyond 10KB. */
  MAX_TOKEN_LENGTH: 10000,
  /** Minimum length — empty token is clearly invalid. */
  MIN_TOKEN_LENGTH: 10,
};

/**
 * A62-C3: Safe bearer token validator.
 * Validates Authorization header bearer tokens before processing.
 */
export const safeBearerToken = z
  .string()
  .min(
    TOKEN_LIMITS.MIN_TOKEN_LENGTH,
    `Token too short (min ${TOKEN_LIMITS.MIN_TOKEN_LENGTH} chars)`,
  )
  .max(TOKEN_LIMITS.MAX_TOKEN_LENGTH, `Token too long (max ${TOKEN_LIMITS.MAX_TOKEN_LENGTH} chars)`)
  .regex(/^[A-Za-z0-9._-]+$/, "Bearer token contains invalid characters");

/**
 * A62-C3: Extract and validate Authorization header.
 * Returns the bearer token or null if invalid.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+([A-Za-z0-9._-]+)$/);
  if (!match) return null;

  const token = match[1];
  const validation = safeBearerToken.safeParse(token);
  return validation.success ? token : null;
}

/**
 * A62-C1: URL query string length validation.
 * Prevents clients from sending extremely long query strings that could
 * exhaust parser memory or logs.
 */
export const QUERY_STRING_LIMITS = {
  /** Maximum length of a URL query string. */
  MAX_LENGTH: 8192,
};

/**
 * A62-C1: Validate query string length.
 * Returns null if safe, or an error message if unsafe.
 */
export function validateQueryStringLength(queryString: string): string | null {
  if (queryString.length > QUERY_STRING_LIMITS.MAX_LENGTH) {
    return `Query string too long (max ${QUERY_STRING_LIMITS.MAX_LENGTH} chars)`;
  }
  return null;
}
