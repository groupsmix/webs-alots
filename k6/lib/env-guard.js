/**
 * Shared environment guard for the k6 scripts (smoke.js, booking-flow.js).
 *
 * Centralises the BASE_URL safety checks so every k6 entrypoint behaves
 * identically:
 *   - HTTPS is mandatory (loopback exempt) so credentials/cookies never travel
 *     in plaintext.
 *   - The target host must be a recognised Oltigo host (allowlist) — an
 *     unknown/typo'd/attacker-controlled host is refused outright.
 *   - Production requires an explicit ALLOW_PROD=true opt-in.
 *   - Load mode (high-VU ramp) is refused against production even with
 *     ALLOW_PROD=true.
 */

/**
 * Recognised Oltigo hosts (and, where noted, their subdomains). Anything else
 * is treated as "unknown" and rejected. Kept exported for diagnostic messages.
 */
export const ALLOWED_HOSTS = [
  "oltigo.com",
  "staging.oltigo.com",
  "preview.oltigo.com",
  "localhost",
];

/** Non-production parent zones — these and ALL their subdomains are non-prod. */
const NON_PROD_ZONES = ["staging.oltigo.com", "preview.oltigo.com"];

/**
 * Classify a hostname as "local" | "non-prod" | "prod" | "unknown".
 *
 * Fix #10 — correctness of subdomain classification.
 * The previous implementation iterated ALLOWED_HOSTS in declaration order and
 * matched the apex `oltigo.com` suffix FIRST. Because `.oltigo.com` is also a
 * suffix of `.staging.oltigo.com`, a clinic subdomain such as
 * `acme.staging.oltigo.com` matched the apex branch and was misclassified as
 * PROD — blocking load mode and demanding ALLOW_PROD for a staging host. The
 * non-prod parent zones are now checked BEFORE the apex so the most-specific
 * match wins.
 */
export function classifyHost(hostname) {
  // Loopback is always local.
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return "local";
  }

  // Non-prod zones (and any subdomain of them) win over the apex match.
  for (const zone of NON_PROD_ZONES) {
    if (hostname === zone || hostname.endsWith(`.${zone}`)) {
      return "non-prod";
    }
  }

  // Apex production domain.
  if (hostname === "oltigo.com") {
    return "prod";
  }

  // Other subdomains of the apex: demo/staging/preview prefixes are non-prod
  // (e.g. "demo.oltigo.com", "pr-42.preview.oltigo.com" is already handled
  // above); everything else under oltigo.com is treated as production.
  if (hostname.endsWith(".oltigo.com")) {
    if (
      hostname.startsWith("staging") ||
      hostname.startsWith("preview") ||
      hostname.startsWith("demo")
    ) {
      return "non-prod";
    }
    return "prod";
  }

  return "unknown";
}

/**
 * Validate the target BASE_URL and return its classification, or throw with an
 * actionable message. Call this from a k6 `setup()`.
 *
 * @param {string} baseUrl            value of __ENV.BASE_URL
 * @param {object} [opts]
 * @param {boolean} [opts.isLoadMode] whether the script is running a high-VU
 *                                    ramp (refused against production)
 * @param {boolean} [opts.allowProd]  value of (__ENV.ALLOW_PROD === "true")
 * @returns {{ baseUrl: string, hostname: string, hostClass: string,
 *             isLocal: boolean, isProd: boolean }}
 */
export function validateBaseUrl(baseUrl, opts = {}) {
  const { isLoadMode = false, allowProd = false } = opts;

  if (!baseUrl) {
    throw new Error(
      "BASE_URL is required. Example: k6 run --env BASE_URL=https://staging.oltigo.com <script>",
    );
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`BASE_URL is not a valid URL: ${baseUrl}`);
  }

  const hostname = parsed.hostname;
  const hostClass = classifyHost(hostname);
  const isLocal = hostClass === "local";

  // HTTPS enforcement (loopback exempt) — never send cookies/tokens in clear.
  if (!isLocal && parsed.protocol !== "https:") {
    throw new Error(
      `BASE_URL must use HTTPS (got '${parsed.protocol}'). ` +
        `Plaintext URLs are not permitted — even on staging, credentials travel over the wire.`,
    );
  }

  // Allowlist enforcement.
  if (hostClass === "unknown") {
    throw new Error(
      `BASE_URL hostname '${hostname}' is not a recognised Oltigo host. ` +
        `Allowed hosts: ${ALLOWED_HOSTS.join(", ")} (and their subdomains). ` +
        `If this is intentional, add it to ALLOWED_HOSTS in k6/lib/env-guard.js.`,
    );
  }

  const isProd = hostClass === "prod";

  // Production opt-in.
  if (isProd && !allowProd) {
    throw new Error(
      `BASE_URL resolves to a production host (${hostname}). Set --env ALLOW_PROD=true to confirm.`,
    );
  }

  // Load mode is staging/preview ONLY — refused against prod even with ALLOW_PROD.
  if (isProd && isLoadMode) {
    throw new Error(
      `Load mode (high-VU ramp) is not permitted against production (${hostname}). ` +
        `Run load tests against a staging/preview host instead. ALLOW_PROD does not override this.`,
    );
  }

  // Strip any trailing slash so callers can safely do `${baseUrl}/api/…`
  // without generating double-slashed URLs (e.g. BASE_URL=https://staging.oltigo.com/).
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return { baseUrl: cleanBaseUrl, hostname, hostClass, isLocal, isProd };
}
