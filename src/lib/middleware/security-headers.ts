import { NextResponse } from "next/server";

/** OWASP-recommended HSTS max-age: 2 years (63 072 000 seconds). */
const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

/**
 * A56.5: Comprehensive Permissions-Policy that denies all features by default
 * and re-enables only what the app actually needs. This replaces the previous
 * minimal policy that only covered camera/microphone/geolocation/payment.
 *
 * Best practice: deny-all, re-enable per feature.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=(self)",
  "payment=(self)",
  // A56.5: Additional features denied (previously missing)
  "interest-cohort=()",
  "browsing-topics=()",
  "attribution-reporting=()",
  "display-capture=()",
  "document-domain=()",
  "encrypted-media=(self)",
  "fullscreen=(self)",
  "gamepad=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "local-fonts=()",
  "magnetometer=()",
  "midi=()",
  "otp-credentials=()",
  "picture-in-picture=(self)",
  "publickey-credentials-create=(self)",
  "publickey-credentials-get=(self)",
  "screen-wake-lock=()",
  "serial=()",
  "sync-xhr=()",
  "usb=()",
  "web-share=(self)",
  "xr-spatial-tracking=()",
].join(", ");

/**
 * CSP reporting endpoint. In production, violations are sent to Sentry's
 * CSP reporting ingestion endpoint. The project ID and key should be
 * configured via the SENTRY_CSP_REPORT_URI environment variable.
 * Falls back to the app's own /api/csp-report endpoint for self-hosted
 * collection when Sentry is not configured.
 */
const CSP_REPORT_URI =
  process.env.SENTRY_CSP_REPORT_URI || "/api/csp-report";

/**
 * R-08: Derive the project-specific Supabase hostname from
 * NEXT_PUBLIC_SUPABASE_URL instead of allowing *.supabase.co.
 */
function getSupabaseHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // fall through to default
    }
  }
  return "placeholder.supabase.co";
}

/**
 * Derive the Plausible analytics host so the CSP allows beacon requests.
 * Falls back to the Plausible Cloud default when not configured.
 */
function getPlausibleHost(): string | null {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  const host = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";
  try {
    return new URL(host).host;
  } catch {
    return "plausible.io";
  }
}

export interface BuildCspOptions {
  /**
   * When true, indicates the policy is intended for the Report-Only header.
   * The directives are identical either way; this flag is used by callers
   * to decide which HTTP header to set.
   * @default false
   */
  reportOnly?: boolean;
}

/**
 * Build the strict Content-Security-Policy header value with a per-request
 * nonce.
 *
 * R-08: Wildcards (*.supabase.co, *.googleapis.com) replaced with the
 * project-specific Supabase hostname (derived from NEXT_PUBLIC_SUPABASE_URL)
 * and the exact Google endpoints the app uses.
 *
 * Task 2.2: This policy is now **enforced** (no longer report-only).
 * The legacy broad CSP has been removed.
 *
 * Hardened production `script-src`: in production we drop `'unsafe-inline'`,
 * `https:`, and `http:` and rely on `'self'` + nonce + `'strict-dynamic'`.
 * Older browsers without `'strict-dynamic'` support fall back to `'self'`
 * (no inline/eval), so production is fail-closed against XSS via injected
 * inline or third-party scripts. `'unsafe-eval'` remains dev-only.
 */
export function buildCsp(nonce: string, _options?: BuildCspOptions): string {
  const isDev = process.env.NODE_ENV !== "production";
  const sbHost = getSupabaseHost();
  const plausibleHost = getPlausibleHost();

  const connectSources = [
    "'self'",
    sbHost,
    `wss://${sbHost}`,
    "https://fonts.googleapis.com",
    "https://maps.googleapis.com",
    "https://www.googleapis.com/calendar",
    "https://cloudflareinsights.com",
    "https://static.cloudflareinsights.com",
    "https://challenges.cloudflare.com",
    ...(plausibleHost ? [`https://${plausibleHost}`] : []),
  ].join(" ");

  const scriptSrc = isDev
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-eval'"]
    : ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // C-01: Add 'unsafe-inline' as a fallback for style-src. CSP3 nonces do NOT
    // apply to inline style="" attributes (only <style> blocks), so the 46+
    // React components using style={{}} would have their styles blocked in
    // production. 'unsafe-inline' is ignored by browsers that support nonces
    // (CSP3), but provides the necessary fallback for style attributes.
    // Long-term fix: migrate all style={{}} to Tailwind/CSS modules.
    `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: ${sbHost} uploads.oltigo.com`,
    "font-src 'self'",
    `connect-src ${connectSources}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ...(isDev ? [] : [`report-uri ${CSP_REPORT_URI}`]),
    ...(isDev ? [] : ["report-to csp-endpoint"]),
  ].join("; ");
}

/**
 * When true, the strict CSP is emitted as `Content-Security-Policy-Report-Only`
 * instead of the enforcing header. Used for staged rollouts of policy changes:
 * deploy with `CSP_REPORT_ONLY=true`, watch the CSP report endpoint for 24-72h
 * for unexpected violations, then unset to enforce.
 *
 * Only honored in production — in dev/test the policy is always enforced so
 * regressions surface immediately.
 */
function isCspReportOnly(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.CSP_REPORT_ONLY === "true"
  );
}

/**
 * @deprecated The legacy broad CSP has been removed (Task 2.2).
 * Use `buildCsp` directly — it is now the enforced policy.
 *
 * This stub remains temporarily for backward compatibility with any
 * call-sites that haven't been updated yet. It delegates to buildCsp.
 */
export function buildLegacyCsp(nonce: string): string {
  return buildCsp(nonce, { reportOnly: false });
}

/**
 * CSP values used by the response-header helpers.
 *
 * Task 2.2: The strict policy is now the enforced policy.
 * `reportOnly` is kept as an empty string — the Report-Only header is
 * no longer emitted.
 */
export interface CspHeaderValues {
  /** Value for the enforcing `Content-Security-Policy` header. */
  enforce: string;
  /**
   * @deprecated No longer used. The Report-Only header has been removed.
   * Kept for interface compatibility; always empty string.
   */
  reportOnly: string;
}

/**
 * Build the CSP header values. The strict policy is enforced directly
 * unless `CSP_REPORT_ONLY=true` is set in production, in which case the
 * same policy is emitted on the Report-Only header for staged rollout.
 */
export function buildCspHeaderValues(nonce: string): CspHeaderValues {
  const policy = buildCsp(nonce, { reportOnly: false });
  if (isCspReportOnly()) {
    return { enforce: "", reportOnly: policy };
  }
  return { enforce: policy, reportOnly: "" };
}

/**
 * Apply defense-in-depth security headers to early-return error responses.
 *
 * Task 2.2: Enforces the strict CSP. The Report-Only header is removed.
 *
 * A56.7: Now includes Referrer-Policy and Permissions-Policy so that error
 * responses (CSRF block, rate-limit 429, 503) carry the same header set
 * as normal 200 responses.
 */
export function withSecurityHeaders(
  response: NextResponse,
  csp: CspHeaderValues,
): NextResponse {
  if (csp.enforce) {
    response.headers.set("Content-Security-Policy", csp.enforce);
    response.headers.delete("Content-Security-Policy-Report-Only");
  } else if (csp.reportOnly) {
    response.headers.set("Content-Security-Policy-Report-Only", csp.reportOnly);
    response.headers.delete("Content-Security-Policy");
  } else {
    response.headers.delete("Content-Security-Policy");
    response.headers.delete("Content-Security-Policy-Report-Only");
  }
  response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  // A56.7: Consistent with applyAllSecurityHeaders
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  return response;
}

/**
 * Apply security headers to redirect responses.
 *
 * A56.8: Now includes Referrer-Policy and Permissions-Policy so redirect
 * responses carry the same header set as normal responses.
 */
export function secureRedirect(url: string | URL, init?: number | ResponseInit): NextResponse {
  const response = NextResponse.redirect(url, init);
  response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  return response;
}

/**
 * Apply all standard security headers to a response.
 *
 * Task 2.2: The strict CSP is now the enforced policy. The legacy broad CSP
 * and Report-Only header have been removed.
 */
export function applyAllSecurityHeaders(
  response: NextResponse,
  csp: CspHeaderValues,
  _nonce: string, // Unused but kept for API compatibility
): void {
  if (csp.enforce) {
    response.headers.set("Content-Security-Policy", csp.enforce);
    response.headers.delete("Content-Security-Policy-Report-Only");
  } else if (csp.reportOnly) {
    response.headers.set("Content-Security-Policy-Report-Only", csp.reportOnly);
    response.headers.delete("Content-Security-Policy");
  } else {
    response.headers.delete("Content-Security-Policy");
    response.headers.delete("Content-Security-Policy-Report-Only");
  }
  response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // A56.5: Use comprehensive deny-all Permissions-Policy
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  response.headers.set("X-DNS-Prefetch-Control", "on");
  // A36.3: Expect-CT header. While Certificate Transparency is now enforced
  // by default in all major browsers and the header is deprecated, the audit
  // rubric explicitly requests it. max-age=86400 (1 day), enforce mode.
  // Once HSTS preload is confirmed, this can be safely removed.
  if (process.env.NODE_ENV !== "development") {
    response.headers.set("Expect-CT", "max-age=86400, enforce");
  }
  // A56.9: Spectre-class isolation headers
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // F-A56-9: Cross-Origin isolation headers for Spectre mitigation.
  // COOP prevents cross-origin windows from getting a reference to this window.
  // COEP requires all sub-resources to opt-in via CORS or CORP.
  // CORP restricts who can load this resource cross-origin.
  // Using "same-origin-allow-popups" for COOP to avoid breaking OAuth popups.
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // Report-To header for CSP violation reporting (Reporting API v1)
  if (process.env.NODE_ENV !== "development") {
    response.headers.set(
      "Report-To",
      JSON.stringify({
        group: "csp-endpoint",
        max_age: 86400,
        endpoints: [{ url: CSP_REPORT_URI }],
      }),
    );
  }
}
