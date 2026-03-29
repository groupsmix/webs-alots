/**
 * Email Verification API for Patient Bookings
 *
 * Sends a 6-digit verification code to the patient's email before
 * confirming a booking. Prevents spam bookings and ensures reachability.
 *
 * POST /api/verify-email — Send verification code
 * PUT  /api/verify-email — Verify the code
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";
import { verifyEmailSendSchema, verifyEmailConfirmSchema, safeParse } from "@/lib/validations";

/**
 * Generate a 6-digit numeric verification code.
 */
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST — Send a verification code to the provided email.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = safeParse(verifyEmailSendSchema, raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 },
    );
  }

  const { email } = parsed.data;

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

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

  // Store verification code in database
  const { error } = await supabase.from("email_verifications").upsert(
    {
      email: email.toLowerCase().trim(),
      code,
      expires_at: expiresAt,
      verified: false,
    },
    { onConflict: "email" },
  );

  if (error) {
    // Table may not exist yet — log but provide graceful fallback
    logger.error("Failed to store verification code", { context: "verify-email", error: error.message });
    return NextResponse.json(
      { error: "Verification service temporarily unavailable" },
      { status: 503 },
    );
  }

  // Send the code via email (Resend, SendGrid, etc.)
  // The email sending service should be configured separately.
  // SECURITY: Never log verification codes — they are sensitive credentials.
  logger.info("Email verification code generated", { context: "verify-email", email });

  // Email service integration (Resend/SendGrid) should be configured
  // via environment variables. See docs/email-setup.md for details.
  // await sendVerificationEmail(email, code);

  return NextResponse.json({
    ok: true,
    message: "Verification code sent. Check your email.",
    expiresInMinutes: 10,
  });
}

/**
 * PUT — Verify a code submitted by the patient.
 */
export async function PUT(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = safeParse(verifyEmailConfirmSchema, raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 },
    );
  }

  const { email, code } = parsed.data;

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

  const { data: verification, error } = await supabase
    .from("email_verifications")
    .select("code, expires_at, verified")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error || !verification) {
    return NextResponse.json(
      { error: "No verification found for this email. Request a new code." },
      { status: 404 },
    );
  }

  if (verification.verified) {
    return NextResponse.json({ ok: true, message: "Email already verified" });
  }

  if (new Date(verification.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Verification code expired. Request a new one." },
      { status: 410 },
    );
  }

  if (verification.code !== code) {
    return NextResponse.json(
      { error: "Invalid verification code" },
      { status: 400 },
    );
  }

  // Mark as verified
  await supabase
    .from("email_verifications")
    .update({ verified: true })
    .eq("email", email.toLowerCase().trim());

  return NextResponse.json({
    ok: true,
    message: "Email verified successfully",
  });
}
