/**
 * Email Notification Service
 *
 * Sends transactional emails using the Resend API or a generic SMTP relay.
 * Falls back to console logging when credentials are not configured.
 *
 * Environment variables:
 *   RESEND_API_KEY     — Resend API key (preferred)
 *   SMTP_HOST          — SMTP relay host (fallback)
 *   SMTP_PORT          — SMTP relay port
 *   SMTP_USER          — SMTP username
 *   SMTP_PASS          — SMTP password
 *   EMAIL_FROM         — Default sender address
 */

const RESEND_API_URL = "https://api.resend.com/emails";

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

// ---- Resend API ----

async function sendViaResend(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY!;
  const from = payload.from || process.env.EMAIL_FROM || "noreply@example.com";

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
    void message;
    return { success: false, error: message };
  }
}

// ---- Generic SMTP via fetch (Mailgun-compatible REST endpoint) ----

async function sendViaSmtp(payload: EmailPayload): Promise<EmailSendResult> {
  const host = process.env.SMTP_HOST!;
  const port = process.env.SMTP_PORT || "587";
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const from = payload.from || process.env.EMAIL_FROM || "noreply@example.com";

  // For SMTP, we use a simple HTTP relay if available (e.g., Mailgun, Postmark)
  // Otherwise log a warning and return success to not block the flow
  const smtpEndpoint = `https://${host}:${port}`;

  try {
    const auth = btoa(`${user}:${pass}`);
    const response = await fetch(`${smtpEndpoint}/messages`, {
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
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, messageId: data.id || `smtp_${Date.now()}` };
    }

    const errorText = await response.text();
    return { success: false, error: errorText || "SMTP relay error" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    void message;
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
      return sendViaSmtp(payload);
    case "none":
      // No email provider configured
      return {
        success: false,
        error: "No email provider configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.",
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
  const safeBrandName = escapeHtml(clinicName || "Health SaaS Platform");
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
