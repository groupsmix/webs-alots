/**
 * Supabase Edge Function: parse-medical-document
 *
 * Triggered by a database webhook whenever a new row is inserted into
 * patient_files. Fetches the uploaded file from Cloudflare R2, decrypts
 * it (AES-256-GCM, same scheme as the Next.js app), sends it to Claude
 * for structured extraction of Moroccan medical documents, then writes
 * the result back to patient_files.extracted_data.
 *
 * If criticalFindings are detected, medical_alerts rows are inserted so
 * that clinic staff are notified immediately.
 *
 * Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service-role JWT (webhook auth + DB writes)
 *   ANTHROPIC_API_KEY         — Claude API key
 *   R2_ACCOUNT_ID             — Cloudflare account ID
 *   R2_ACCESS_KEY_ID          — R2 S3-compatible access key
 *   R2_SECRET_ACCESS_KEY      — R2 S3-compatible secret key
 *   R2_BUCKET_NAME            — R2 bucket that stores patient files
 *   PHI_ENCRYPTION_KEY        — Hex-encoded 256-bit AES-GCM key (same as app)
 *
 * OWASP / Security notes:
 *   - Authorization: every request must carry the service-role key as a
 *     Bearer token or in Authorization header. Requests without a valid
 *     token are rejected with 401.
 *   - No PHI is ever logged — only file IDs and status codes.
 *   - Anthropic API key is read from env vars exclusively.
 *   - Tenant isolation: every DB mutation includes .eq("clinic_id", ...).
 *   - Retry logic: up to MAX_RETRIES=3; after that, status = "failed".
 */

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const CLAUDE_MAX_TOKENS = 2000;
const ANTHROPIC_TIMEOUT_MS = 90_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Compares two secrets without leaking length/content via timing.
 * Returns false on length mismatch (token lengths are fixed, so this does
 * not leak meaningful information) and otherwise accumulates byte diffs so
 * the loop always runs to completion.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length === 0 || ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ── Extraction prompt ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Tu es un expert en analyse de documents médicaux marocains.
Analyse ce document médical et extrais les informations structurées.

Retourne UNIQUEMENT ce JSON (sans Markdown):
{
  "documentType": "lab_result|prescription|radiology|discharge_summary|other",
  "labResults": [
    {
      "testName": "Nom du test",
      "value": "Valeur",
      "unit": "Unité",
      "referenceRange": "Plage normale",
      "flag": "H|L|critical|normal",
      "interpretation": "Interprétation"
    }
  ],
  "medications": [
    {
      "name": "Médicament",
      "dosage": "Posologie",
      "frequency": "Fréquence",
      "duration": "Durée"
    }
  ],
  "diagnoses": ["Diagnostic 1", "Diagnostic 2"],
  "criticalFindings": ["Résultat critique si présent"],
  "summary": "Résumé en 2-3 phrases",
  "date": "YYYY-MM-DD si trouvé"
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a hex string to a Uint8Array backed by a concrete ArrayBuffer. */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  // Allocate a concrete ArrayBuffer so Web Crypto APIs accept the result
  // without further casting (avoids ArrayBufferLike vs ArrayBuffer mismatch).
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Decrypt a buffer encrypted by the Next.js app's `encryptBuffer()`.
 *
 * Supported formats (mirrors src/lib/encryption.ts):
 *   v1:     [0x01][12-byte IV][ciphertext + 16-byte GCM auth tag]
 *   legacy: [12-byte IV][ciphertext + 16-byte GCM auth tag]
 */
async function decryptBuffer(encrypted: Uint8Array, phiKeyHex: string): Promise<Uint8Array> {
  const keyBytes = hexToBytes(phiKeyHex);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);

  // `.slice()` on a Uint8Array returns Uint8Array<ArrayBufferLike>; we need
  // a concrete ArrayBuffer for crypto.subtle APIs. Copy into new ArrayBuffers.
  let iv: Uint8Array<ArrayBuffer>;
  let ciphertext: Uint8Array<ArrayBuffer>;

  // Detect versioned format (first byte == 0x01)
  if (encrypted[0] === 0x01 && encrypted.length > 13) {
    const ivBuf = new ArrayBuffer(12);
    new Uint8Array(ivBuf).set(encrypted.subarray(1, 13));
    iv = new Uint8Array(ivBuf);

    const ctBuf = new ArrayBuffer(encrypted.length - 13);
    new Uint8Array(ctBuf).set(encrypted.subarray(13));
    ciphertext = new Uint8Array(ctBuf);
  } else {
    // Legacy: bare IV prepended
    const ivBuf = new ArrayBuffer(12);
    new Uint8Array(ivBuf).set(encrypted.subarray(0, 12));
    iv = new Uint8Array(ivBuf);

    const ctBuf = new ArrayBuffer(encrypted.length - 12);
    new Uint8Array(ctBuf).set(encrypted.subarray(12));
    ciphertext = new Uint8Array(ctBuf);
  }

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  return new Uint8Array(plaintext);
}

/**
 * Build an AWS S3-compatible presigned GET URL for a Cloudflare R2 object.
 * Uses `aws4fetch` which ships as an ESM module compatible with Deno.
 */
async function getR2PresignedUrl(
  aws: AwsClient,
  accountId: string,
  bucketName: string,
  key: string,
  expiresIn = 60,
): Promise<string> {
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  // aws4fetch has no top-level `expiresIn` option — presigned-URL expiry is
  // set via the X-Amz-Expires query param. Putting it in the URL both fixes
  // the type error and actually enforces the intended expiry window (the
  // previous `expiresIn` property was silently ignored at runtime).
  const url = `${endpoint}/${bucketName}/${key}?X-Amz-Expires=${expiresIn}`;
  const request = await aws.sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  });
  return request.url;
}

/**
 * Fetch and decode a patient file from R2.
 * Handles the `.enc` suffix convention for PHI-encrypted files.
 *
 * Returns the raw (possibly encrypted) bytes and whether the file is encrypted.
 */
async function fetchFileFromR2(
  aws: AwsClient,
  accountId: string,
  bucketName: string,
  r2Key: string,
): Promise<{ data: Uint8Array; isEncrypted: boolean }> {
  // Try the encrypted version first (PHI files have `.enc` suffix)
  const encKey = r2Key.endsWith(".enc") ? r2Key : `${r2Key}.enc`;
  const plainKey = r2Key.endsWith(".enc") ? r2Key.slice(0, -4) : r2Key;

  const tryFetch = async (key: string) => {
    const presignedUrl = await getR2PresignedUrl(aws, accountId, bucketName, key);
    const resp = await fetch(presignedUrl);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  };

  const encData = await tryFetch(encKey);
  if (encData) return { data: encData, isEncrypted: true };

  const plainData = await tryFetch(plainKey);
  if (plainData) return { data: plainData, isEncrypted: false };

  throw new Error(`File not found in R2 (tried ${encKey} and ${plainKey})`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // ── OWASP A01: Broken Access Control ──
  // Only accept requests that carry the Supabase service-role key as a Bearer
  // token. DB webhook triggers always include this header.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!serviceKey || !timingSafeEqual(token, serviceKey)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Validate env vars ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const r2AccountId = Deno.env.get("R2_ACCOUNT_ID");
  const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const r2BucketName = Deno.env.get("R2_BUCKET_NAME");
  const phiEncryptionKey = Deno.env.get("PHI_ENCRYPTION_KEY");

  if (!supabaseUrl) return json({ error: "SUPABASE_URL not configured" }, 503);
  if (!anthropicKey) return json({ error: "AI not configured" }, 503);
  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
    return json({ error: "R2 storage not configured" }, 503);
  }

  // ── OWASP A03: Injection — validate payload shape ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const record = payload?.record;

  if (!record?.id || typeof record.id !== "string" || !UUID_RE.test(record.id)) {
    return json({ error: "Invalid payload: record.id must be a UUID" }, 400);
  }
  if (
    !record?.clinic_id ||
    typeof record.clinic_id !== "string" ||
    !UUID_RE.test(record.clinic_id)
  ) {
    return json({ error: "Invalid payload: record.clinic_id must be a UUID" }, 400);
  }
  if (!record?.r2_key || typeof record.r2_key !== "string") {
    return json({ error: "Invalid payload: record.r2_key is required" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const aws = new AwsClient({
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
    service: "s3",
    region: "auto",
  });

  // Mark as processing (tenant-scoped)
  await supabase
    .from("patient_files")
    .update({ extraction_status: "processing" })
    .eq("id", record.id)
    .eq("clinic_id", record.clinic_id);

  try {
    // ── Fetch file from R2 ──
    const { data: rawBytes, isEncrypted } = await fetchFileFromR2(
      aws,
      r2AccountId,
      r2BucketName,
      record.r2_key as string,
    );

    // ── Decrypt if needed (AES-256-GCM, matches Next.js encryptBuffer) ──
    let fileBytes: Uint8Array;
    if (isEncrypted) {
      if (!phiEncryptionKey) {
        throw new Error("PHI_ENCRYPTION_KEY required to decrypt file");
      }
      fileBytes = await decryptBuffer(rawBytes, phiEncryptionKey);
    } else {
      fileBytes = rawBytes;
    }

    // ── Determine content type from file_type column or magic bytes ──
    const fileType = (record.file_type as string | undefined) ?? "";
    const contentType =
      fileType.startsWith("image/") || fileType === "application/pdf"
        ? fileType
        : detectContentType(fileBytes);

    const isImage = contentType.startsWith("image/");
    const isPDF = contentType === "application/pdf";

    if (!isImage && !isPDF) {
      await supabase
        .from("patient_files")
        .update({ extraction_status: "failed", extraction_error: "Unsupported file type" })
        .eq("id", record.id)
        .eq("clinic_id", record.clinic_id);
      return json({ error: "Unsupported file type" }, 422);
    }

    // ── Build Claude message content ──
    const base64 = uint8ToBase64(fileBytes);

    const messageContent: unknown[] = [];
    if (isImage) {
      messageContent.push({
        type: "image",
        source: { type: "base64", media_type: contentType, data: base64 },
      });
    } else {
      // PDF
      messageContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    }
    messageContent.push({ type: "text", text: EXTRACTION_PROMPT });

    // ── Call Anthropic Claude ──
    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        messages: [{ role: "user", content: messageContent }],
      }),
      signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
    });

    if (!anthropicResp.ok) {
      throw new Error(`Anthropic API error: ${anthropicResp.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiData = (await anthropicResp.json()) as any;
    const rawText: string = aiData?.content?.[0]?.text ?? "";

    // Strip Markdown fences the model may add despite the prompt
    const cleanText = rawText
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extracted: any;
    try {
      extracted = JSON.parse(cleanText);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // ── Persist extracted data (tenant-scoped) ──
    await supabase
      .from("patient_files")
      .update({
        extracted_data: extracted,
        extraction_status: "completed",
        extracted_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq("id", record.id)
      .eq("clinic_id", record.clinic_id);

    // ── Create medical_alerts for critical findings ──
    const criticalFindings: string[] = Array.isArray(extracted?.criticalFindings)
      ? extracted.criticalFindings.filter((f: unknown) => typeof f === "string" && f.trim())
      : [];

    for (const finding of criticalFindings) {
      await supabase.from("medical_alerts").insert({
        clinic_id: record.clinic_id,
        patient_id: (record.patient_id as string | null | undefined) ?? null,
        alert_type: "critical_value",
        severity: "critical",
        // Never log the raw finding — only store it in the DB row.
        // (DB is encrypted at rest; no PHI leaves the function via logs.)
        message: finding,
        source_file_id: record.id,
        acknowledged: false,
        created_at: new Date().toISOString(),
      });
    }

    return json({ success: true, criticalFindingsCount: criticalFindings.length });
  } catch (err) {
    // OWASP A09: Security Logging — do NOT include file content or PHI in the error
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const newRetryCount = ((record.extraction_retry_count as number | undefined) ?? 0) + 1;
    const nextStatus = newRetryCount >= MAX_RETRIES ? "failed" : "pending";

    await supabase
      .from("patient_files")
      .update({
        extraction_status: nextStatus,
        extraction_retry_count: newRetryCount,
        extraction_error: errorMsg,
      })
      .eq("id", record.id)
      .eq("clinic_id", record.clinic_id);

    return json({ error: errorMsg, status: nextStatus }, 500);
  }
});

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * Detect content type from magic bytes (file signature).
 * Used when file_type is missing or unreliable.
 */
function detectContentType(bytes: Uint8Array): string {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return "application/pdf";
  // WebP: RIFF????WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return "application/octet-stream";
}

/**
 * Encode a Uint8Array to base64 without relying on Node.js `Buffer`.
 * Uses the Web Platform `btoa` which is available in Deno.
 *
 * Large files are processed in chunks to avoid stack overflow when
 * spreading into `String.fromCharCode`.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
