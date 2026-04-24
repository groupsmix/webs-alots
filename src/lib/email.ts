/**
 * Email Notification Service
 *
 * Sends transactional emails using the Resend API or a generic SMTP relay.
 * Falls back to console logging when credentials are not configured.
 *
 * Environment variables:
 *   RESEND_API_KEY     — Resend API key (preferred)
 *   EMAIL_RELAY_HOST   — HTTP relay host (e.g., "api.mailgun.net/v3/mg.example.com")
 *   EMAIL_RELAY_PORT   — HTTP relay port (default: 443)
 *   EMAIL_RELAY_USER   — HTTP relay username / API key name
 *   EMAIL_RELAY_PASS   — HTTP relay password / API key
 *   EMAIL_FROM         — Default sender address
 *
 * Legacy env vars SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are still
 * supported as fallbacks for backward compatibility.
 */

import { escapeHtml } from "@/lib/escape-html";
import { logger } from "@/lib/logger";


const RESEND_API_URL = "https://api.resend.com/emails";

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

// ---- Provider detection ----

type EmailProvider = "resend" | "smtp" | "none";

function detectProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (
    (process.env.EMAIL_RELAY_HOST || process.env.SMTP_HOST) &&
    (process.env.EMAIL_RELAY_USER || process.env.SMTP_USER) &&
    (process.env.EMAIL_RELAY_PASS || process.env.SMTP_PASS)
  ) return "smtp";
  return "none";
}

// ---- Resend API ----

async function sendViaResend(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }
    const from = payload.from || process.env.EMAIL_FROM || "noreply@oltigo.com";

    try {
      const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.id };
    }

    return {
      success: false,
      error: data.message || data.error || "Failed to send via Resend",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Resend email send failed", { context: "email", error: err });
    return { success: false, error: message };
  }
}

// ---- Generic HTTP relay (Mailgun / Postmark / compatible REST API) ----
//
// This transport speaks JSON over HTTPS to HTTP-based transactional email
// APIs such as Mailgun or Postmark. It is NOT a raw SMTP transport.
//
// Environment variables:
//   EMAIL_RELAY_HOST  — HTTP relay host (e.g., "api.mailgun.net/v3/mg.example.com")
//   EMAIL_RELAY_PORT  — HTTPS port (default: 443). Port 587 is SMTP and will NOT work.
//   EMAIL_RELAY_USER  — HTTP relay username / API key name
//   EMAIL_RELAY_PASS  — HTTP relay password / API key
//
// Legacy env vars SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are still
// supported as fallbacks but their names are misleading — this is HTTP, not SMTP.
// If you need raw SMTP (port 25/465/587), integrate a Node.js SMTP
// library like `nodemailer` instead.

async function sendViaHttpRelay(payload: EmailPayload): Promise<EmailSendResult> {
  const host = process.env.EMAIL_RELAY_HOST || process.env.SMTP_HOST;
  const port = process.env.EMAIL_RELAY_PORT || process.env.SMTP_PORT || "443";
  const user = process.env.EMAIL_RELAY_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_RELAY_PASS || process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { success: false, error: "EMAIL_RELAY_HOST, EMAIL_RELAY_USER, and EMAIL_RELAY_PASS must all be configured" };
  }
    const from = payload.from || process.env.EMAIL_FROM || "noreply@oltigo.com";

    // Build the HTTPS endpoint. For standard HTTPS (port 443), omit the port
  // to avoid issues with TLS certificate validation on non-standard ports.
  const baseUrl = port === "443" ? `https://${host}` : `https://${host}:${port}`;

  try {
    const auth = btoa(`${user}:${pass}`);
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, messageId: data.id || `smtp_${Date.now()}` };
    }

    const errorText = await response.text();
    return { success: false, error: errorText || "HTTP relay error" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("HTTP relay email send failed", { context: "email", error: err });
    return { success: false, error: message };
  }
}

// ---- Public API ----

/**
 * Send a transactional email using the best available provider.
 * Automatically detects Resend or SMTP configuration.
 * Falls back to console logging when no provider is configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const provider = detectProvider();

  switch (provider) {
    case "resend":
      return sendViaResend(payload);
    case "smtp":
      return sendViaHttpRelay(payload);
    case "none":
      // No email provider configured
      return {
        success: false,
        error: "No email provider configured. Set RESEND_API_KEY or EMAIL_RELAY_HOST/EMAIL_RELAY_USER/EMAIL_RELAY_PASS.",
      };
  }
}

/**
 * Send a notification email with the clinic branding wrapper.
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  body: string,
  clinicName?: string,
): Promise<EmailSendResult> {
  const safeBrandName = escapeHtml(clinicName || "Oltigo");
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(body);

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="padding:24px 32px;background:#0f172a;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">${safeBrandName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b;">${safeSubject}</h2>
        <div style="font-size:14px;line-height:1.6;color:#475569;">
          ${safeBody}
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          ${safeBrandName} &mdash; Plateforme de gestion m&eacute;dicale
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return sendEmail({ to, subject, html });
}
