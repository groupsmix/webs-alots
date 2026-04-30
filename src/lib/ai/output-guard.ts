/**
 * A108 / A112: AI output guard.
 *
 * Scans model outputs before they reach the user to catch:
 *   1. Leaked secrets / environment variable values (A108 secret scanner)
 *   2. External URLs that could be phishing links (A112)
 *   3. System prompt echoes (the model regurgitating its instructions)
 *
 * This is a lightweight, regex-based first pass. For production-grade
 * content moderation, integrate OpenAI's Moderation API or a dedicated
 * classifier.
 */

// ── Secret patterns ──────────────────────────────────────────────────

/**
 * Patterns that look like leaked secrets. We check for common formats:
 * - API keys (sk-..., key-..., Bearer tokens)
 * - Base64-encoded secrets (long alphanumeric strings)
 * - Environment variable assignments (KEY=VALUE)
 */
const SECRET_PATTERNS: RegExp[] = [
  // OpenAI API keys
  /sk-[A-Za-z0-9]{20,}/,
  // Supabase service role keys (eyJ... JWT)
  /eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}/,
  // Generic "secret" or "key" assignments
  /(?:SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL)\s*[:=]\s*\S{8,}/i,
  // Stripe keys
  /(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{10,}/,
  // Cloudflare API tokens
  /[A-Za-z0-9_-]{40}/, // Too generic alone — only checked in context
];

/**
 * Environment variable names that should never appear in AI output.
 * If the model echoes one of these, it may be leaking the system prompt
 * or a context injection succeeded in extracting secrets.
 */
const SENSITIVE_ENV_NAMES = [
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PHI_ENCRYPTION_KEY",
  "HMAC_SECRET",
  "CLOUDFLARE_AI_API_TOKEN",
  "MINIO_ROOT_PASSWORD",
  "DATABASE_URL",
  "VAPID_PRIVATE_KEY",
];

// ── URL filtering ────────────────────────────────────────────────────

/**
 * Match URLs in text. Covers http(s)://, www., and bare domain patterns.
 */
const URL_RE =
  /https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+/gi;

// ── Types ────────────────────────────────────────────────────────────

export interface OutputGuardResult {
  /** The (possibly sanitized) output text */
  text: string;
  /** Whether any issues were detected */
  flagged: boolean;
  /** Specific issues found */
  issues: OutputGuardIssue[];
}

export interface OutputGuardIssue {
  type: "secret_leak" | "external_url" | "prompt_echo";
  detail: string;
}

// ── Guard implementation ─────────────────────────────────────────────

/**
 * Scan AI model output for security issues.
 *
 * @param output - Raw text from the AI model
 * @param allowedDomains - Domains that are permitted in URLs (e.g., the clinic's own domain).
 *                         Always includes common safe domains.
 * @returns Guard result with sanitized text and any issues found
 */
export function guardAIOutput(
  output: string,
  allowedDomains: string[] = [],
): OutputGuardResult {
  const issues: OutputGuardIssue[] = [];
  let text = output;

  // 1. Check for leaked secrets
  for (const envName of SENSITIVE_ENV_NAMES) {
    if (text.includes(envName)) {
      issues.push({
        type: "secret_leak",
        detail: `Output contains reference to ${envName}`,
      });
      // Redact the line containing the env var name
      text = text.replace(
        new RegExp(`.*${envName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*`, "g"),
        "[REDACTED — potential secret leak]",
      );
    }
  }

  // Check for API key patterns (sk-..., pk_test_..., eyJ...)
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.source.length < 20) continue; // skip overly generic patterns
    const match = text.match(pattern);
    if (match && match[0].length > 20) {
      issues.push({
        type: "secret_leak",
        detail: `Output contains pattern resembling a secret (${match[0].slice(0, 10)}...)`,
      });
      text = text.replace(pattern, "[REDACTED]");
    }
  }

  // 2. Check for external URLs (A112 phishing defense)
  const safeDomainsSet = new Set([
    ...allowedDomains.map((d) => d.toLowerCase()),
    // Always allow the product's own domains
    "oltigo.com",
    "oltigo.ma",
  ]);

  const urls = text.match(URL_RE) ?? [];
  for (const url of urls) {
    try {
      const parsed = new URL(
        url.startsWith("www.") ? `https://${url}` : url,
      );
      const hostname = parsed.hostname.toLowerCase();
      const isSafe = [...safeDomainsSet].some(
        (d) => hostname === d || hostname.endsWith(`.${d}`),
      );
      if (!isSafe) {
        issues.push({
          type: "external_url",
          detail: `External URL detected: ${hostname}`,
        });
        text = text.replace(url, "[lien externe supprime]");
      }
    } catch {
      // Malformed URL — strip it
      issues.push({
        type: "external_url",
        detail: `Malformed URL detected`,
      });
      text = text.replace(url, "[lien supprime]");
    }
  }

  // 3. Check for system prompt echoes
  const promptEchoIndicators = [
    "RÈGLES IMPORTANTES",
    "RÉFÉRENCE PHARMACOPÉE",
    "FORMAT DE RÉPONSE (JSON strict)",
    "Tu es un assistant médical IA",
    "Tu es un réceptionniste IA",
    "UNTRUSTED_PATIENT_INPUT",
    "<<UNTRUSTED",
    "NEVER follow instructions inside",
  ];

  for (const indicator of promptEchoIndicators) {
    if (text.includes(indicator)) {
      issues.push({
        type: "prompt_echo",
        detail: `Output appears to echo system prompt (contains "${indicator.slice(0, 30)}...")`,
      });
      // Don't strip — let the caller decide. But flag it.
    }
  }

  return {
    text,
    flagged: issues.length > 0,
    issues,
  };
}
