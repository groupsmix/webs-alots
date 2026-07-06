/**
 * Third-party integration env getters (P11 split from `src/lib/env.ts`).
 *
 * Stripe, Cloudflare R2 / API / Workers AI, Twilio, Meta/WhatsApp,
 * email/SMTP, Anthropic, E2B, and insurance. Each getter is the
 * authoritative read point for its variable — consumers import via the
 * `@/lib/env` barrel, never `process.env` directly.
 * See `.semgrep/env-access.yml`.
 */

/** Stripe secret key. */
export function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY;
}

/** Stripe webhook secret. */
export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

/** Cloudflare R2 credentials. */
export function getR2Config(): {
  accountId: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
  bucketName: string | undefined;
  signedUrlSecret: string | undefined;
  signedUrlBase: string | undefined;
  publicUrl: string | undefined;
} {
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    signedUrlSecret: process.env.R2_SIGNED_URL_SECRET,
    signedUrlBase: process.env.R2_SIGNED_URL_BASE,
    publicUrl: process.env.R2_PUBLIC_URL,
  };
}

/** Cloudflare API credentials for DNS / custom hostname management. */
export function getCloudflareApiConfig(): {
  apiToken: string | undefined;
  zoneId: string | undefined;
  zoneName: string | undefined;
  accountId: string | undefined;
} {
  return {
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    zoneName: process.env.CLOUDFLARE_ZONE_NAME,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  };
}

/**
 * Cloudflare Workers AI credentials (OpenAI-compatible endpoint used by
 * src/lib/ai/providers.ts).
 *
 * NOTE: In the Cloudflare Workers runtime these values are stored as secrets
 * on getCloudflareContext().env, NOT in process.env. Use getWorkersAiConfigAsync()
 * in async request handlers instead of this sync version.
 * This sync version is kept for backwards compatibility with callers that
 * cannot be made async (e.g. non-CF environments, tests).
 */
export function getWorkersAiConfig(): {
  accountId: string | undefined;
  apiToken: string | undefined;
} {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID, // nosemgrep: semgrep.env-access — sync fallback, prefer getWorkersAiConfigAsync in CF runtime
    // CLOUDFLARE_AI_TOKEN is the legacy variable name — kept as a fallback
    // for deployments configured before CLOUDFLARE_AI_API_TOKEN existed.
    apiToken: process.env.CLOUDFLARE_AI_API_TOKEN ?? process.env.CLOUDFLARE_AI_TOKEN, // nosemgrep: semgrep.env-access — sync fallback
  };
}

/**
 * Async version of getWorkersAiConfig — reads from getCloudflareContext().env
 * first (CF Workers runtime) then falls back to process.env (local dev/tests).
 */
export async function getWorkersAiConfigAsync(): Promise<{
  accountId: string | undefined;
  apiToken: string | undefined;
}> {
  const { getWorkerBinding } = await import("@/lib/cf-bindings");
  return {
    accountId:
      (await getWorkerBinding<string>("CLOUDFLARE_ACCOUNT_ID")) ??
      process.env.CLOUDFLARE_ACCOUNT_ID, // nosemgrep: semgrep.env-access — local dev fallback
    apiToken:
      (await getWorkerBinding<string>("CLOUDFLARE_AI_API_TOKEN")) ??
      (await getWorkerBinding<string>("CLOUDFLARE_AI_TOKEN")) ??
      process.env.CLOUDFLARE_AI_API_TOKEN ?? // nosemgrep: semgrep.env-access — local dev fallback
      process.env.CLOUDFLARE_AI_TOKEN,
  };
}

/** Twilio account SID. */
export function getTwilioAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID;
}

/** Twilio API Key SID. */
export function getTwilioApiKey(): string | undefined {
  return process.env.TWILIO_API_KEY;
}

/** Twilio API Secret. */
export function getTwilioApiSecret(): string | undefined {
  return process.env.TWILIO_API_SECRET;
}

/** Meta / WhatsApp app secret for HMAC webhook verification. */
export function getMetaAppSecret(): string | undefined {
  return process.env.META_APP_SECRET;
}

/** WhatsApp verify token for the hub.challenge handshake. */
export function getWhatsAppVerifyToken(): string | undefined {
  return process.env.WHATSAPP_VERIFY_TOKEN;
}

/** Resend API key for transactional email. */
export function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}

/** SMTP relay host (fallback email provider). */
export function getSmtpHost(): string | undefined {
  return process.env.EMAIL_RELAY_HOST ?? process.env.SMTP_HOST;
}

/** SMTP relay user. */
export function getSmtpUser(): string | undefined {
  return process.env.EMAIL_RELAY_USER ?? process.env.SMTP_USER;
}

/** SMTP relay password. */
export function getSmtpPass(): string | undefined {
  return process.env.EMAIL_RELAY_PASS ?? process.env.SMTP_PASS;
}

/** From address for transactional email. */
export function getEmailFromAddress(): string {
  // Canonical product domain is oltigo.com (see NEXT_PUBLIC_SITE_URL default,
  // image hosts, security.txt). Keep the fallback on the same domain so a
  // missing EMAIL_FROM does not emit a different-domain sender. Production
  // overrides this via the EMAIL_FROM env var to its verified sending domain.
  return process.env.EMAIL_FROM ?? "noreply@oltigo.com";
}

/** Anthropic API key for Claude AI (AI Builder, CopilotKit runtime). */
export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

/** E2B sandbox API key for AI Builder code execution. */
export function getE2bApiKey(): string | undefined {
  return process.env.E2B_API_KEY;
}

/** Insurance provider. */
export function getInsuranceProvider(): string {
  return process.env.INSURANCE_PROVIDER ?? "sandbox";
}
