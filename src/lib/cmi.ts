/**
 * CMI (Centre Monétique Interbancaire) Payment Gateway Integration
 *
 * Morocco's primary payment processor for online card payments.
 * Implements the CMI hosted payment page flow:
 *   1. Merchant creates a payment request with signed parameters
 *   2. Customer is redirected to CMI's hosted payment page
 *   3. CMI processes the payment and redirects back with result
 *   4. CMI sends a server-to-server callback for confirmation
 *
 * Required env vars:
 *   CMI_MERCHANT_ID  — Merchant ID provided by CMI
 *   CMI_SECRET_KEY   — HMAC secret key for signing requests
 *
 * Optional env vars:
 *   CMI_GATEWAY_URL  — CMI gateway URL (defaults to production)
 */

import { sha512Base64, timingSafeEqual } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";

// ---- Types ----

export interface CmiPaymentRequest {
  amount: number;
  currency?: string;
  orderId: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  failUrl: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}

export interface CmiPaymentResponse {
  success: boolean;
  formUrl: string;
  formFields: Record<string, string>;
  error?: string;
}

export interface CmiCallbackData {
  orderId: string;
  amount: string;
  transactionId?: string;
  authCode?: string;
  status: "approved" | "declined" | "error";
  responseCode: string;
  hash: string;
  raw: Record<string, string>;
}

// ---- Configuration ----

// nosemgrep: semgrep.env-access — CMI gateway URL with safe default; not in env.ts to keep payment module self-contained
const CMI_GATEWAY_URL = process.env.CMI_GATEWAY_URL || "https://payment.cmi.co.ma/fim/est3Dgate";

function getCmiConfig() {
  // nosemgrep: semgrep.env-access — payment credentials read at runtime
  const merchantId = process.env.CMI_MERCHANT_ID;
  const secretKey = process.env.CMI_SECRET_KEY;

  if (!merchantId || !secretKey) return null;

  return { merchantId, secretKey };
}

/**
 * Check if CMI is configured and available.
 */
export function isCmiConfigured(): boolean {
  return getCmiConfig() !== null;
}

// ---- CMI ver3 Hash ----

/**
 * Escape a parameter value for the CMI `ver3` hash payload.
 *
 * P0-1(b): CMI joins values with `|`, so any `|` (and the escape char `\`)
 * inside a value MUST be escaped, otherwise the concatenation is ambiguous
 * and two distinct field maps can serialize to the same input — a forgeable
 * canonicalization. CMI's spec escapes `\` first (`\` → `\\`), then `|`
 * (`|` → `\|`). Order matters: escaping `\` last would double-escape the
 * backslash introduced by the `|` rule.
 */
function escapeCmiValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * Generate the CMI `ver3` hash for request signing / callback verification.
 *
 * P0-1(a): CMI ver3 is **plain SHA-512** over the canonical payload with the
 * store key appended — it is NOT an HMAC. The previous implementation used
 * HMAC-SHA256 (hex), which the live CMI gateway rejects outright, so real
 * card payments never validated.
 *
 * Canonical payload, per CMI's documented algorithm:
 *   1. Sort parameter NAMES case-insensitively (the gateway lowercases for
 *      ordering; sorting by the raw mixed-case key puts all uppercase keys
 *      before lowercase ones and produces a different order than CMI).
 *   2. Escape `\` and `|` in each value (see {@link escapeCmiValue}).
 *   3. Join the escaped values with `|`.
 *   4. Append the store key (also escaped) with a trailing `|` separator.
 *   5. SHA-512 the UTF-8 bytes, base64-encoded.
 */
export async function generateHash(
  fields: Record<string, string>,
  secretKey: string,
): Promise<string> {
  const sortedKeys = Object.keys(fields).sort((a, b) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0,
  );
  const escapedValues = sortedKeys.map((k) => escapeCmiValue(fields[k] ?? ""));
  // CMI appends the (escaped) store key to the pipe-joined values.
  const hashInput = escapedValues.join("|") + "|" + escapeCmiValue(secretKey);
  return sha512Base64(hashInput);
}

// ---- Payment Creation ----

/**
 * Create a CMI payment request.
 * Returns the form URL and fields needed to redirect the customer
 * to CMI's hosted payment page.
 */
export async function createCmiPayment(request: CmiPaymentRequest): Promise<CmiPaymentResponse> {
  const config = getCmiConfig();
  if (!config) {
    return {
      success: false,
      formUrl: "",
      formFields: {},
      error: "CMI is not configured. Set CMI_MERCHANT_ID and CMI_SECRET_KEY.",
    };
  }

  const currency = request.currency || "504"; // 504 = MAD (ISO 4217)

  // P3: parse the shop origin once, up front. When NEXT_PUBLIC_SITE_URL is
  // unset the origin allowlist below is skipped, so successUrl is otherwise
  // unvalidated — guard the parse so a malformed URL returns a clean error
  // instead of throwing out of the handler.
  let shopOrigin: string;
  try {
    shopOrigin = new URL(request.successUrl).origin;
  } catch {
    return {
      success: false,
      formUrl: "",
      formFields: {},
      error: `Invalid success URL: ${request.successUrl}`,
    };
  }

  // W8-R-02: Whitelist successUrl, failUrl, callbackUrl origins to prevent
  // an attacker from setting an external shopurl that redirects the user to
  // a phishing page after payment. Only the site's own origin is allowed.
  // nosemgrep: semgrep.env-access — NEXT_PUBLIC_SITE_URL used for origin allowlist
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    const allowedOrigin = new URL(siteUrl).origin;
    for (const urlField of [request.successUrl, request.failUrl, request.callbackUrl]) {
      try {
        const origin = new URL(urlField).origin;
        if (origin !== allowedOrigin) {
          return {
            success: false,
            formUrl: "",
            formFields: {},
            error: `Redirect URL origin (${origin}) does not match site URL (${allowedOrigin})`,
          };
        }
      } catch {
        return {
          success: false,
          formUrl: "",
          formFields: {},
          error: `Invalid redirect URL: ${urlField}`,
        };
      }
    }
  }

  // Build form fields for CMI hosted payment page
  const fields: Record<string, string> = {
    clientid: config.merchantId,
    amount: request.amount.toFixed(2),
    currency,
    oid: request.orderId,
    okUrl: request.successUrl,
    failUrl: request.failUrl,
    callbackUrl: request.callbackUrl,
    // P3: derive the shop origin with the URL parser, not string-splitting.
    shopurl: shopOrigin,
    TranType: "PreAuth",
    lang: "fr",
    BillToName: request.customerName || "",
    email: request.customerEmail || "",
    description: request.description || "Payment",
  };

  // Add metadata as custom fields
  if (request.metadata) {
    for (const [key, value] of Object.entries(request.metadata)) {
      fields[`rnd_${key}`] = value;
    }
  }

  // Generate HMAC hash
  const hash = await generateHash(fields, config.secretKey);
  fields.hash = hash;
  fields.encoding = "UTF-8";
  fields.hashAlgorithm = "ver3";
  fields.storeType = "3D_PAY_HOSTING";

  return {
    success: true,
    formUrl: CMI_GATEWAY_URL,
    formFields: fields,
  };
}

// ---- Callback Verification ----

/**
 * Verify and parse a CMI callback/redirect response.
 * Validates the HMAC hash to ensure the response is authentic.
 */
export async function verifyCmiCallback(
  params: Record<string, string>,
): Promise<CmiCallbackData | null> {
  const config = getCmiConfig();
  if (!config) return null;

  const receivedHash = params.HASH || params.hash;
  if (!receivedHash) return null;

  // S-06 + S0-11-04: Rebuild hash from received parameters using only known
  // CMI fields. Unknown params are NOT included in the HMAC reconstruction.
  // S0-11-04: Normalize field names to lowercase for comparison so sandbox
  // vs production casing differences (e.g. BillToName → billtoname) don't
  // cause HMAC mismatches. The original key is kept in fieldsToHash so the
  // hash value itself matches what CMI computed.
  const CMI_KNOWN_HASH_FIELDS_LOWER = new Set([
    "clientid",
    "amount",
    "currency",
    "oid",
    "okurl",
    "failurl",
    "callbackurl",
    "shopurl",
    "trantype",
    "lang",
    "billtoname",
    "email",
    "description",
    "storetype",
    "procreturncode",
    "transid",
    "authcode",
    "response",
    "mdstatus",
    "txstatus",
    "ireqcode",
    "ireqdetail",
    "vendorcode",
    "paressyntaxok",
    "paresverified",
    "cavv",
    "cavvalgorithm",
    "eci",
    "xid",
    "md",
    "rnd",
  ]);

  const fieldsToHash: Record<string, string> = {};
  // W8-W-02: Track lowercase keys to detect case-duplicates (e.g. OID + oid
  // in the same callback). If CMI ever sends both, the second would silently
  // overwrite the first in fieldsToHash, changing the HMAC input.
  const seenLowerKeys = new Set<string>();
  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "hash" && lowerKey !== "encoding" && lowerKey !== "hashalgorithm") {
      // S-06: Only include known CMI fields or rnd_* / EXTRA.* custom fields
      if (
        CMI_KNOWN_HASH_FIELDS_LOWER.has(lowerKey) ||
        lowerKey.startsWith("rnd_") ||
        key.startsWith("EXTRA.")
      ) {
        if (seenLowerKeys.has(lowerKey)) {
          logger.warn("CMI callback contains case-duplicate field, rejecting", {
            context: "cmi",
            duplicateKey: key,
          });
          return null;
        }
        seenLowerKeys.add(lowerKey);
        fieldsToHash[key] = value;
      }
    }
  }

  const expectedHash = await generateHash(fieldsToHash, config.secretKey);

  // P0-1(a): base64 is case-SENSITIVE, so do NOT lowercase the received hash
  // (the old HMAC-hex scheme could, base64 cannot). Compare verbatim.
  // Constant-time comparison to prevent timing attacks.
  if (!timingSafeEqual(expectedHash, receivedHash)) {
    return null; // Invalid hash — potential tampering
  }

  const responseCode = params.ProcReturnCode || params.procreturncode || "";
  const isApproved = responseCode === "00";
  const isDeclined = responseCode !== "00" && responseCode !== "";

  return {
    orderId: params.oid || params.OID || "",
    amount: params.amount || params.AMOUNT || "0",
    transactionId: params.TransId || params.transid,
    authCode: params.AuthCode || params.authcode,
    status: isApproved ? "approved" : isDeclined ? "declined" : "error",
    responseCode,
    hash: receivedHash,
    raw: params,
  };
}
