/**
 * Application configuration with startup validation.
 * 
 * Critical environment variables are validated at module load time
 * so the application fails fast on startup rather than at runtime.
 */

/**
 * CRITICAL-02 FIX: Validate BOOKING_TOKEN_SECRET at startup.
 * The booking system cannot function without this secret, so we
 * fail immediately if it's missing rather than returning 503 errors
 * to users at runtime.
 */
export const BOOKING_TOKEN_SECRET = (() => {
  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "BOOKING_TOKEN_SECRET environment variable must be set. " +
      "Generate one with: openssl rand -base64 32"
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "BOOKING_TOKEN_SECRET must be at least 32 characters for security. " +
      "Current length: " + secret.length
    );
  }
  return secret;
})();

/**
 * Other critical secrets that should be validated at startup.
 */
export const CRON_SECRET = (() => {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "CRON_SECRET environment variable must be set in production. " +
      "Generate one with: openssl rand -base64 32"
    );
  }
  return secret;
})();

/**
 * Supabase configuration (required).
 */
export const SUPABASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable must be set");
  }
  return url;
})();

export const SUPABASE_ANON_KEY = (() => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable must be set");
  }
  return key;
})();

export const SUPABASE_SERVICE_ROLE_KEY = (() => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable must be set in production");
  }
  return key;
})();
