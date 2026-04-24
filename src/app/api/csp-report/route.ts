import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * CSP Violation Report Endpoint
 * 
 * Receives CSP violation reports from browsers when policy is violated.
 * These are silently logged for security monitoring - we don't want to
 * leak information to attackers about our security setup.
 * 
 * Note: This is for Content-Security-Policy-Report-Only header.
 * Production CSP would use report-uri (or report-to in newer browsers).
 */

/**
 * Parse and sanitize CSP violation report for logging
 */
interface CspViolationReport {
  "csp-report"?: {
    "blocked-uri"?: string;
    "violated-directive"?: string;
    "document-uri"?: string;
    "referrer"?: string;
    "original-policy"?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CspViolationReport;
    const report = body["csp-report"];

    if (report) {
      // Log CSP violation for security monitoring
      // Elevated to error with alert: true to ensure Sentry catches it
      // and triggers a dashboard/alert rule (Audit 3.4 Fix)
      logger.error("CSP violation detected", {
        context: "csp-report",
        blockedUri: report["blocked-uri"],
        violatedDirective: report["violated-directive"],
        documentUri: report["document-uri"],
        referrer: report["referrer"],
        alert: true,
      });
    }

    // Always return 204 No Content - we don't want to acknowledge receipt
    return new NextResponse(null, { status: 204 });
  } catch {
    // Invalid report - still return success to not leak info
    return new NextResponse(null, { status: 204 });
  }
}

// GET requests are not meaningful for CSP reports
export async function GET() {
  return new NextResponse(null, { status: 204 });
}