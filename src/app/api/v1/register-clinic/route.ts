/**
 * POST /api/v1/register-clinic
 *
 * Self-service clinic registration endpoint (no auth required).
 * Creates a new clinic + admin auth user + assigns the free "vitrine" plan
 * + generates a subdomain + sends a WhatsApp welcome message.
 *
 * R-12 Fix: Requires ONE of:
 *   - DNS TXT record verification on the clinic's website domain
 *   - Phone OTP to a pre-listed clinic registry (pending)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiValidationError, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import {
  generateDnsVerificationToken,
  isDnsVerificationConfigured,
  normalizeDomain,
} from "@/lib/dns-verification";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { escapeSlackMrkdwn } from "@/lib/escape-slack";
import { generateSubdomain } from "@/lib/generate-subdomain";
import { logger } from "@/lib/logger";
import { phoneToWhatsApp } from "@/lib/morocco";
import { createRateLimiter, extractClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase-server";
import { normalizeText, safeParse } from "@/lib/validations";
import { sendTextMessage } from "@/lib/whatsapp";

// ---------------------------------------------------------------------------
// Anti-Abuse Rate Limiter
// ---------------------------------------------------------------------------
// Extremely strict rate limit for public registration (2 per hour per IP)
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 2 });

// ---------------------------------------------------------------------------
// Slack webhook for registration alerts (R-12 fix)
// ---------------------------------------------------------------------------
const SLACK_WEBHOOK_URL = process.env.SLACK_REGISTRATION_ALERTS_WEBHOOK_URL;

/**
 * Send an alert to Slack when a new clinic registers.
 * 
 * A8-02 Fix: If Slack webhook fails, send email fallback to operations team
 * and emit metrics for monitoring.
 */
async function sendSlackRegistrationAlert(data: {
  clinicName: string;
  doctorName: string;
  email: string;
  phone: string;
  specialty: string;
  city?: string;
  verificationMethod: string;
  clientIp: string;
}): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    // A8-01: Never log PII - use only non-sensitive identifiers
    logger.info("New clinic registration (no Slack webhook configured)", {
      context: "register-clinic",
      verificationMethod: data.verificationMethod,
      city: data.city, // City is not PII
      specialty: data.specialty, // Medical specialty is not PII
      // PII fields (clinicName, doctorName, email, phone) are NOT logged
    });
    return;
  }

  // A15 fix: every interpolated value is user-supplied and reaches a
  // `mrkdwn` block, so escape `<`, `>`, and `&` to neutralise mention /
  // link injection (`<!channel>`, `<@U123>`, `<https://evil|x>`).
  const message = {
    text: "New clinic registration",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "New Clinic Registration", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Clinic:*\n${escapeSlackMrkdwn(data.clinicName)}` },
          { type: "mrkdwn", text: `*Doctor:*\n${escapeSlackMrkdwn(data.doctorName)}` },
          { type: "mrkdwn", text: `*Email:*\n${escapeSlackMrkdwn(data.email)}` },
          { type: "mrkdwn", text: `*Phone:*\n${escapeSlackMrkdwn(data.phone)}` },
          { type: "mrkdwn", text: `*Specialty:*\n${escapeSlackMrkdwn(data.specialty)}` },
          { type: "mrkdwn", text: `*City:*\n${escapeSlackMrkdwn(data.city) || "N/A"}` },
          {
            type: "mrkdwn",
            text: `*Verification:*\n${escapeSlackMrkdwn(data.verificationMethod)}`,
          },
          { type: "mrkdwn", text: `*IP:*\n${escapeSlackMrkdwn(data.clientIp)}` },
        ],
      },
    ],
  };

  // A8-02 Fix: Wrap Slack POST in try-catch with email fallback
  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      // Non-200 status code - treat as failure
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Slack webhook returned ${response.status}: ${errorText}`);
    }

    // A8-02 Fix: Emit success metric
    logger.info("Slack registration alert sent successfully", {
      context: "register-clinic",
      metric: "slack.post.success",
      verificationMethod: data.verificationMethod,
    });
  } catch (err) {
    // A8-02 Fix: Log failure and emit metric
    logger.error("Failed to send Slack registration alert", {
      context: "register-clinic",
      metric: "slack.post.failure",
      error: err,
    });

    // A8-02 Fix: Send email fallback to operations team
    await sendRegistrationEmailFallback(data, err);
  }
}

/**
 * Send email fallback notification to operations team when Slack fails.
 * 
 * A8-02 Fix: Ensures operations team is notified of new registrations
 * even when Slack webhook is unavailable.
 */
async function sendRegistrationEmailFallback(
  data: {
    clinicName: string;
    doctorName: string;
    email: string;
    phone: string;
    specialty: string;
    city?: string;
    verificationMethod: string;
    clientIp: string;
  },
  slackError: unknown
): Promise<void> {
  const operationsEmail = process.env.OPERATIONS_EMAIL;

  if (!operationsEmail) {
    logger.error("Cannot send email fallback: OPERATIONS_EMAIL not configured", {
      context: "register-clinic",
      metric: "email.fallback.failure",
    });
    return;
  }

  const timestamp = new Date().toISOString();
  const errorMessage = slackError instanceof Error ? slackError.message : String(slackError);

  const emailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <div style="background:#dc2626;color:white;padding:16px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">⚠️ New Clinic Registration (Slack Failed)</h2>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="color:#475569;margin:0 0 16px;">
          A new clinic has registered, but the Slack notification failed. Please process this registration manually.
        </p>
        
        <div style="background:white;padding:16px;border-radius:6px;margin:16px 0;">
          <h3 style="margin:0 0 12px;color:#1e293b;font-size:16px;">Registration Details</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;width:140px;">Clinic Name:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.clinicName)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">Doctor Name:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.doctorName)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">Email:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.email)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">Phone:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.phone)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">Specialty:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.specialty)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">City:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.city || "N/A")}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">Website:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.verificationMethod)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">IP Address:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(data.clientIp)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-weight:600;">Timestamp:</td>
              <td style="padding:8px 0;color:#1e293b;">${escapeHtml(timestamp)}</td>
            </tr>
          </table>
        </div>

        <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;margin:16px 0;">
          <h4 style="margin:0 0 8px;color:#991b1b;font-size:14px;">Slack Error Details</h4>
          <p style="margin:0;color:#7f1d1d;font-size:13px;font-family:monospace;">${escapeHtml(errorMessage)}</p>
        </div>

        <p style="color:#64748b;font-size:13px;margin:16px 0 0;">
          This is an automated fallback notification. The clinic record has been created successfully in the database.
        </p>
      </div>
    </div>
  `.trim();

  try {
    const emailResult = await sendEmail({
      to: operationsEmail,
      subject: `⚠️ New Clinic Registration: ${data.clinicName} (Slack Failed)`,
      html: emailHtml,
    });

    if (emailResult.success) {
      logger.info("Email fallback sent successfully", {
        context: "register-clinic",
        metric: "email.fallback.success",
      });
    } else {
      logger.error("Email fallback failed to send", {
        context: "register-clinic",
        metric: "email.fallback.failure",
        error: emailResult.error,
      });
    }
  } catch (err) {
    logger.error("Email fallback threw exception", {
      context: "register-clinic",
      metric: "email.fallback.failure",
      error: err,
    });
  }
}

/**
 * Verify domain ownership via DNS TXT record using Cloudflare DNS-over-HTTPS.
 *
 * The clinic must add a TXT record with the format: oltigo-verify=<token>
 * on either the apex domain or the `_oltigo` subdomain. We query both names
 * via Cloudflare's public DoH endpoint and look for an exact match against
 * `oltigo-verify=<token>`.
 *
 * Fail-closed: any error or missing record causes verification to fail.
 *
 * @param hostname The normalized hostname (already validated)
 * @param token The server-derived verification token
 * @returns true if verification succeeds
 */
async function verifyDnsTxtRecord(hostname: string, token: string): Promise<boolean> {
  try {
    const verificationRecord = `oltigo-verify=${token}`;
    const namesToQuery = [hostname, `_oltigo.${hostname}`];

    for (const name of namesToQuery) {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`;
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
      });
      if (!res.ok) continue;

      const json = (await res.json()) as { Answer?: Array<{ data?: string }> };
      const answers = json.Answer ?? [];
      for (const ans of answers) {
        // DoH returns TXT data wrapped in quotes (possibly multiple strings).
        const raw = (ans.data ?? "").trim();
        const stripped = raw.replace(/^"|"$/g, "").replace(/"\s+"/g, "");
        if (stripped === verificationRecord) {
          return true;
        }
      }
    }

    logger.info("DNS TXT verification did not find matching record", {
      context: "register-clinic",
      hostname,
    });
    return false;
  } catch (err) {
    logger.warn("DNS TXT verification failed", {
      context: "register-clinic",
      hostname,
      error: err,
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

// A14-04 / A14-05: name fields are normalized to NFC and stripped of NUL
// bytes before length checks, so attackers cannot register two visually
// identical clinics using composed-vs-decomposed Unicode and cannot smuggle
// `\u0000` past downstream consumers.
const registerClinicSchema = z.object({
  clinic_name: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, "Le nom de la clinique est requis").max(200)),
  doctor_name: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(2, "Le nom du docteur est requis").max(200)),
  email: z.string().email("Email invalide").max(254),
  phone: z.string().min(8, "Numéro de téléphone invalide").max(30),
  specialty: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(1, "La spécialité est requise").max(200)),
  city: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(200))
    .optional(),
  // F-28: Cloudflare Turnstile token for bot protection
  turnstile_token: z.string().min(1, "Turnstile verification required").optional(),
  // R-12: Identity verification
  // Option 1: DNS TXT record verification.
  // The token is NOT supplied by the client — the server derives it from
  // (email, website_domain) so attackers cannot self-verify by supplying
  // their own token alongside their own domain. Clients must first call
  // POST /api/v1/register-clinic/verification-token to fetch the token,
  // then publish it as a TXT record before calling this endpoint.
  // Accepts either a full URL (`https://myclinic.ma`) or a bare hostname
  // (`myclinic.ma`); both are normalized via normalizeDomain() before use,
  // and the verification-token endpoint accepts the same shapes so the
  // value the user supplies to both endpoints is identical.
  website_domain: z.string().min(1, "Domain is required").max(255).optional(),
  // Option 2: Phone OTP from pre-listed registry
  phone_otp: z.string().optional(),
  phone_otp_id: z.string().optional(),
}).strict();

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // R-12 Fix: Self-service registration is now DISABLED by default
  // It must be explicitly enabled AND require identity verification
  if (process.env.SELF_SERVICE_REGISTRATION_ENABLED !== "true") {
    return apiError("Self-service registration is currently disabled.", 403);
  }

  // Rate limiting (IP-based)
  const clientIp = extractClientIp(request);
  if (!(await registerLimiter.check(`register_${clientIp}`))) {
    logger.warn("Public registration rate-limit exceeded", { context: "register-clinic", ip: clientIp });
    return apiError("Too many registration attempts. Please try again later.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const result = safeParse(registerClinicSchema, body);
  if (!result.success) {
    return apiValidationError(result.error);
  }

  const data = result.data;

  // R-12 Fix: Require ONE identity verification method
  let verificationMethod = "";
  let verificationPassed = false;

  // Option 1: DNS TXT record verification (server-derived token, R-12)
  if (data.website_domain) {
    verificationMethod = "dns-txt-record";

    if (!isDnsVerificationConfigured()) {
      logger.warn("DNS verification attempted but no server secret is configured", {
        context: "register-clinic",
      });
      return apiError(
        "DNS verification is not available. Please contact support.",
        503,
        "DNS_VERIFICATION_UNAVAILABLE",
      );
    }

    const hostname = normalizeDomain(data.website_domain);
    if (!hostname) {
      return apiError("Invalid website domain.", 400, "INVALID_DOMAIN");
    }

    const expectedToken = generateDnsVerificationToken(data.email, hostname);
    if (!expectedToken) {
      return apiError(
        "DNS verification is not available. Please contact support.",
        503,
        "DNS_VERIFICATION_UNAVAILABLE",
      );
    }

    verificationPassed = await verifyDnsTxtRecord(hostname, expectedToken);
    if (!verificationPassed) {
      return apiError(
        "DNS verification failed. Request a token from /api/v1/register-clinic/verification-token and publish it as a TXT record on your domain before retrying.",
        400,
        "DNS_VERIFICATION_FAILED",
      );
    }
  }
  // Option 2: Phone OTP to pre-listed registry (not yet implemented)
  else if (data.phone_otp && data.phone_otp_id) {
    // R-12: Phone OTP verification not yet implemented
    return apiError(
      "Phone OTP verification is not yet available. Please use DNS verification.",
      400,
      "PHONE_OTP_NOT_IMPLEMENTED",
    );
  }
  // No verification method provided
  else {
    return apiError(
      "Identity verification is required. Please provide one of:\n" +
      "- DNS TXT record on your website domain (set website_domain — token is issued via /api/v1/register-clinic/verification-token)\n" +
      "- Phone OTP from pre-listed registry (coming soon)",
      400,
      "VERIFICATION_REQUIRED",
    );
  }

  // F-28: Verify Cloudflare Turnstile token if configured
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!data.turnstile_token) {
      return apiError("Turnstile verification is required", 400);
    }
    try {
      const verifyRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: data.turnstile_token,
            remoteip: clientIp,
          }),
        },
      );
      const verifyData = (await verifyRes.json()) as { success: boolean };
      if (!verifyData.success) {
        logger.warn("Turnstile verification failed", {
          context: "register-clinic",
          ip: clientIp,
        });
        return apiError("Bot verification failed. Please try again.", 403);
      }
    } catch (err) {
      logger.error("Turnstile verification request failed", {
        context: "register-clinic",
        error: err,
      });
      // Fail open on Turnstile service outage to avoid blocking all registrations
    }
  }

  try {
    const supabase = createAdminClient();

    // 1. Check if email is already registered.
    // Querying our own "users" table is O(1) and safe for admin.
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();

    if (existingUser) {
      return apiError(
        "Un compte existe déjà avec cet email. Veuillez vous connecter.",
        409,
        "EMAIL_EXISTS",
      );
    }

    // 2. Generate subdomain and check uniqueness
    let subdomain = generateSubdomain(data.clinic_name);

    const { data: existingClinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (existingClinic) {
      // Extremely unlikely with random suffix, but handle it
      subdomain = generateSubdomain(data.clinic_name);
    }

    // 3. Create the auth user with a random password (user will reset via email)
    // We must do this first since the RPC transaction needs the auth_id
    const tempPassword = crypto.randomUUID();
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.doctor_name,
      },
    });

    if (authError || !authUser?.user) {
      logger.error("Failed to create auth user during self-service registration", {
        context: "register-clinic",
        error: authError,
      });
      return apiInternalError("Impossible de créer le compte. Veuillez réessayer.");
    }

    // 4. Create the clinic and user profile atomically (Audit 5.6 Fix)
    const rpc = supabase.rpc as (
      fn: "register_new_clinic",
      args: {
        p_clinic_name: string;
        p_subdomain: string;
        p_phone: string;
        p_doctor_name: string;
        p_email: string;
        p_city: string | null;
        p_specialty: string;
        p_auth_id: string;
      }
    ) => ReturnType<typeof supabase.rpc>;

    const { data: clinicId, error: rpcError } = await rpc("register_new_clinic", {
      p_clinic_name: data.clinic_name,
      p_subdomain: subdomain,
      p_phone: data.phone,
      p_doctor_name: data.doctor_name,
      p_email: data.email,
      p_city: data.city ?? null,
      p_specialty: data.specialty,
      p_auth_id: authUser.user.id,
    });

    if (rpcError || !clinicId) {
      logger.error("Failed to execute atomic registration RPC", {
        context: "register-clinic",
        error: rpcError,
      });
      // The RPC rolled back the DB, but we still need to delete the orphaned auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return apiInternalError("Impossible de créer la clinique et le profil. Veuillez réessayer.");
    }

    // Update the auth user metadata with the newly generated clinic_id
    await supabase.auth.admin.updateUserById(authUser.user.id, {
      user_metadata: {
        full_name: data.doctor_name,
        clinic_id: clinicId,
      }
    });

    // 6. Send WhatsApp welcome message (non-blocking, best-effort)
    const clinicUrl = `https://${subdomain}.oltigo.com`;
    const whatsappPhone = phoneToWhatsApp(data.phone);
    const welcomeMessage =
      `Bienvenue sur Oltigo, Dr ${data.doctor_name} ! 🎉\n\n` +
      `Votre clinique "${data.clinic_name}" est créée.\n` +
      `Votre site : ${clinicUrl}\n\n` +
      `Connectez-vous pour compléter la configuration de votre cabinet :\n` +
      `https://oltigo.com/login\n\n` +
      `À bientôt !`;

    sendTextMessage(whatsappPhone, welcomeMessage).catch((err) => {
      logger.warn("WhatsApp welcome message failed during registration", {
        context: "register-clinic",
        error: err,
      });
    });

    await logAuditEvent({
      supabase,
      action: "clinic_registered",
      type: "admin",
      clinicId,
      actor: authUser.user.id,
      description: `Self-service registration: ${data.clinic_name} (${subdomain})`,
      ipAddress: clientIp,
    });

    // R-12 Fix: Send Slack alert for every registration
    await sendSlackRegistrationAlert({
      clinicName: data.clinic_name,
      doctorName: data.doctor_name,
      email: data.email,
      phone: data.phone,
      specialty: data.specialty,
      city: data.city,
      verificationMethod,
      clientIp,
    });

    logger.info("New clinic registered successfully", {
      context: "register-clinic",
      clinicId: clinicId,
      subdomain,
      verificationMethod,
      ip: clientIp,
    });

    return apiSuccess(
      {
        status: "created",
        message: "Clinique créée avec succès",
        clinic_id: clinicId,
        subdomain,
        clinic_url: clinicUrl,
      },
      201,
    );
  } catch (err) {
    logger.error("Unhandled error in register-clinic", {
      context: "register-clinic",
      error: err,
    });
    return apiInternalError();
  }
}
