import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";

/**
 * CSP Violation Report Endpoint
 *
 * Receives CSP violation reports from browsers when policy is violated.
 * These are silently logged for security monitoring - we don't want to
 * leak information to attackers about our security setup.
 *
 * Receives reports from the enforced Content-Security-Policy header
 * via report-uri / report-to directives.
 *
 * Hardening (Audit #7):
 * - Hard cap the request body at 16 KiB to prevent log/cost amplification
 *   from attacker-controlled payloads.
 * - Truncate every logged field to 500 chars so a single oversized field
 *   cannot dominate the structured log.
 * - Per-IP rate limit (60 req / 60s) so a single client cannot drown
 *   real violations in noise.
 */

const MAX_CSP_REPORT_BYTES = 16 * 1024;
const MAX_FIELD_CHARS = 500;

interface CspViolationReport {
  "csp-report"?: {
    "blocked-uri"?: unknown;
    "violated-directive"?: unknown;
    "document-uri"?: unknown;
    referrer?: unknown;
    "original-policy"?: unknown;
  };
}

/**
 * Per-IP rate limiter for the CSP report endpoint.
 *
 * 60 req / 60s mirrors a typical legitimate violation cadence (page loads
 * usually emit a single report) while throttling clients that are firing
 * synthetic reports. Fail-open is fine here: this endpoint is a logging
 * sink and degrading to "log everything" during a backend outage is safer
 * than dropping real violations.
 */
const cspReportLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
});

/**
 * Coerce a value to a string and truncate to MAX_FIELD_CHARS so a single
 * oversized field cannot dominate the structured log.
 */
function truncateField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > MAX_FIELD_CHARS ? value.slice(0, MAX_FIELD_CHARS) : value;
}

export async function POST(request: NextRequest) {
  // Read the raw body first so we can enforce a hard size cap before
  // parsing. `request.text()` materialises the entire body, but the
  // length check below caps the worst-case work at MAX_CSP_REPORT_BYTES
  // worth of UTF-16 code units.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (raw.length > MAX_CSP_REPORT_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  // Per-IP rate limit. Applied after the size check so a flood of large
  // bodies is rejected by the cheaper guard first.
  const ip = extractClientIp(request);
  const allowed = await cspReportLimiter.check(`csp-report:${ip}`);
  if (!allowed) {
    return new NextResponse(null, { status: 429 });
  }

  let parsed: CspViolationReport;
  try {
    parsed = JSON.parse(raw) as CspViolationReport;
  } catch {
    // Invalid JSON — return 204 to avoid leaking parser behaviour to
    // attackers probing the endpoint.
    return new NextResponse(null, { status: 204 });
  }

  const report = parsed?.["csp-report"];
  if (report && typeof report === "object") {
    // Log CSP violation for security monitoring. Elevated to error with
    // alert: true to ensure Sentry catches it and triggers a dashboard /
    // alert rule (Audit 3.4 Fix). Every field is truncated and the
    // original-policy is intentionally dropped — it is large, low-signal,
    // and attacker-influenced via document-uri reflection.
    logger.error("CSP violation detected", {
      context: "csp-report",
      blockedUri: truncateField(report["blocked-uri"]),
      violatedDirective: truncateField(report["violated-directive"]),
      documentUri: truncateField(report["document-uri"]),
      referrer: truncateField(report.referrer),
      alert: true,
    });
  }

  // Always return 204 No Content — we don't want to acknowledge receipt.
  return new NextResponse(null, { status: 204 });
}

// GET requests are not meaningful for CSP reports
export async function GET() {
  return new NextResponse(null, { status: 204 });
}
