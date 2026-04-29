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

import { hmacSha256Hex, timingSafeEqual } from "@/lib/crypto-utils";

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

const CMI_GATEWAY_URL =
  process.env.CMI_GATEWAY_URL || "https://payment.cmi.co.ma/fim/est3Dgate";

function getCmiConfig() {
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

// ---- HMAC Signature ----

/**
 * Generate HMAC-SHA256 hash for CMI request/response verification.
 * CMI requires fields to be sorted alphabetically and concatenated
 * with pipe (|) separator before hashing.
 */
async function generateHash(
  fields: Record<string, string>,
  secretKey: string,
): Promise<string> {
  const sortedKeys = Object.keys(fields).sort();
  const hashInput = sortedKeys.map((k) => fields[k]).join("|");
  return hmacSha256Hex(secretKey, hashInput);
}

// ---- Payment Creation ----

/**
 * Create a CMI payment request.
 * Returns the form URL and fields needed to redirect the customer
 * to CMI's hosted payment page.
 */
export async function createCmiPayment(
  request: CmiPaymentRequest,
): Promise<CmiPaymentResponse> {
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

  // Build form fields for CMI hosted payment page
  const fields: Record<string, string> = {
    clientid: config.merchantId,
    amount: request.amount.toFixed(2),
    currency,
    oid: request.orderId,
    okUrl: request.successUrl,
    failUrl: request.failUrl,
    callbackUrl: request.callbackUrl,
    shopurl: request.successUrl.split("/").slice(0, 3).join("/"),
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

  // S-06: Rebuild hash from received parameters using only known CMI fields.
  // Unknown params are NOT included in the HMAC reconstruction to prevent
  // an attacker from injecting fields that alter the hash computation.
  const CMI_KNOWN_HASH_FIELDS = new Set([
    'clientid', 'amount', 'currency', 'oid', 'okUrl', 'failUrl',
    'callbackUrl', 'shopurl', 'TranType', 'lang', 'BillToName', 'email',
    'description', 'storeType', 'ProcReturnCode', 'procreturncode',
    'TransId', 'transid', 'AuthCode', 'authcode', 'Response',
    'mdStatus', 'txstatus', 'iReqCode', 'iReqDetail', 'vendorCode',
    'PAResSyntaxOK', 'PAResVerified', 'cavv', 'cavvAlgorithm', 'eci',
    'xid', 'md', 'rnd', 'OID', 'AMOUNT',
  ]);

  const fieldsToHash: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "hash" && lowerKey !== "encoding" && lowerKey !== "hashalgorithm") {
      // S-06: Only include known CMI fields or rnd_* / EXTRA.* custom fields
      if (CMI_KNOWN_HASH_FIELDS.has(key) || key.startsWith('rnd_') || key.startsWith('EXTRA.')) {
        fieldsToHash[key] = value;
      }
    }
  }

  const expectedHash = await generateHash(fieldsToHash, config.secretKey);
  const received = receivedHash.toLowerCase();

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(expectedHash, received)) {
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
