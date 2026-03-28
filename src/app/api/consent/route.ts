/**
 * Consent Logging API
 *
 * Records user consent events for GDPR/Loi 09-08 compliance.
 * Stores consent type, timestamp, and IP for audit trail.
 *
 * POST /api/consent — Log a consent event
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { extractClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const VALID_CONSENT_TYPES = [
  "cookies_accepted",
  "cookies_declined",
  "data_processing",
  "marketing_emails",
  "terms_accepted",
  "privacy_policy_accepted",
] as const;

type ConsentType = (typeof VALID_CONSENT_TYPES)[number];

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  let body: { consentType?: string; granted?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { consentType, granted } = body;

  if (
    !consentType ||
    !VALID_CONSENT_TYPES.includes(consentType as ConsentType)
  ) {
    return NextResponse.json(
      {
        error: `Invalid consent type. Valid types: ${VALID_CONSENT_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (typeof granted !== "boolean") {
    return NextResponse.json(
      { error: "'granted' must be a boolean" },
      { status: 400 },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

  // User may or may not be authenticated (cookie consent can happen pre-login)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    userId = profile?.id ?? null;
  }

  const ip = extractClientIp(request);

  const { error } = await supabase.from("consent_logs").insert({
    user_id: userId,
    consent_type: consentType,
    granted,
    ip_address: ip,
    user_agent: request.headers.get("user-agent") ?? null,
  });

  if (error) {
    // Table may not exist yet — log but don't fail the user experience
    logger.warn("Failed to log consent", { context: "consent", error: error.message });
    return NextResponse.json({ ok: true, logged: false });
  }

  return NextResponse.json({ ok: true, logged: true });
}
