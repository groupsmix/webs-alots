#!/usr/bin/env npx tsx
/**
 * PHI Encryption Key Rotation Script
 *
 * Re-encrypts all PHI files in R2 from PHI_ENCRYPTION_KEY_OLD to PHI_ENCRYPTION_KEY.
 *
 * Prerequisites:
 *   1. Generate a new key:  openssl rand -hex 32
 *   2. Set environment variables:
 *        PHI_ENCRYPTION_KEY=<new-key-hex>
 *        PHI_ENCRYPTION_KEY_OLD=<old-key-hex>
 *        R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Usage:
 *   npx tsx scripts/rotate-phi-key.ts [--dry-run]
 *
 * The script:
 *   1. Lists all .enc files in PHI category prefixes in R2
 *   2. Downloads each encrypted file
 *   3. Decrypts with the OLD key
 *   4. Re-encrypts with the NEW key
 *   5. Uploads the re-encrypted file back to R2
 *   6. Logs progress and failures for manual retry
 *
 * R2 access is performed via the R2 S3 API using inline SigV4 query
 * presigning (Node's `crypto` module) + Node 22's built-in `fetch`. This
 * mirrors the approach in `src/lib/r2.ts` so the Worker bundle does not
 * need the AWS SDK (~48 MiB) which would exceed the 10 MiB Worker limit.
 *
 * See src/lib/encryption.ts for the full key rotation procedure.
 */

import { createHash, createHmac } from "crypto";

// ── Configuration ──

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PHI_PREFIXES = [
  "clinics/*/documents/",
  "clinics/*/prescriptions/",
  "clinics/*/lab-results/",
  "clinics/*/lab_results/",
  "clinics/*/x-rays/",
  "clinics/*/xrays/",
  "clinics/*/medical-records/",
  "clinics/*/medical_records/",
  "clinics/*/patient-files/",
  "clinics/*/patient_files/",
];

// We list from the "clinics/" prefix and filter for .enc files
const ROOT_PREFIX = "clinics/";

const IV_LENGTH = 12; // 96-bit IV for AES-GCM

// Presigned URLs are short-lived — each list/get/put is its own call.
const PRESIGN_TTL_SECONDS = 300;

// ── Crypto helpers ──

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  ) as Uint8Array<ArrayBuffer>;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  if (hexKey.length !== 64) {
    throw new Error(`Key must be 64 hex chars (256 bits), got ${hexKey.length}`);
  }
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", keyBytes.buffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function decryptWithKey(
  encrypted: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  if (encrypted.length < IV_LENGTH + 1) {
    throw new Error("Encrypted data too short");
  }
  const iv = new Uint8Array(encrypted.slice(0, IV_LENGTH)) as Uint8Array<ArrayBuffer>;
  const ciphertext = new Uint8Array(encrypted.slice(IV_LENGTH)) as Uint8Array<ArrayBuffer>;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new Uint8Array(plaintext) as Uint8Array<ArrayBuffer>;
}

async function encryptWithKey(
  plaintext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH) as Uint8Array<ArrayBuffer>);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const result = new Uint8Array(iv.length + ciphertext.byteLength) as Uint8Array<ArrayBuffer>;
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext) as Uint8Array<ArrayBuffer>, iv.length);
  return result;
}

function isPHIFile(key: string): boolean {
  if (!key.endsWith(".enc")) return false;
  const categories = [
    "documents",
    "prescriptions",
    "lab-results",
    "lab_results",
    "x-rays",
    "xrays",
    "medical-records",
    "medical_records",
    "patient-files",
    "patient_files",
  ];
  return categories.some((cat) => key.includes(`/${cat}/`));
}

// ── R2 S3 API: inline SigV4 query presigner ──
//
// Mirrors `presignR2Url` in src/lib/r2.ts. Inlined here so this maintenance
// script remains self-contained and does not need the AWS SDK (which was
// removed to fit the 10 MiB Cloudflare Worker bundle limit).

interface R2PresignConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

/**
 * Build an AWS SigV4 query-presigned URL for the R2 S3 API.
 *
 * `key` may be an empty string to target the bucket root (used for the
 * ListObjectsV2 endpoint). Additional query parameters can be supplied via
 * `opts.query` and are folded into the canonical request so the signature
 * remains valid.
 */
function presignR2Url(
  config: R2PresignConfig,
  method: "PUT" | "GET",
  key: string,
  expiresIn: number,
  opts: { signedHeaders?: Record<string, string>; query?: Record<string, string> } = {},
): string {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  // Each path segment is URI-encoded but "/" separators are preserved. An
  // empty `key` produces the bucket root (`/{bucket}/`) which is the path
  // used by ListObjectsV2.
  const canonicalUri =
    "/" +
    `${config.bucketName}/${key}`
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD
  const region = "auto";
  const service = "s3";
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Host is always signed; plus any caller-supplied headers (lower-cased).
  const headers: Record<string, string> = { host };
  for (const [k, v] of Object.entries(opts.signedHeaders ?? {})) {
    headers[k.toLowerCase()] = v;
  }
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
    ...(opts.query ?? {}),
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const hash = (data: string) => createHash("sha256").update(data).digest("hex");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonicalRequest)].join("\n");

  const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();
  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// ── R2 S3 API: minimal client (LIST / GET / PUT) ──

interface ListResult {
  keys: string[];
  nextContinuationToken: string | undefined;
}

/**
 * Parse a key value out of a `<Key>...</Key>` XML element, decoding the
 * limited set of XML entities R2's ListObjectsV2 response can contain. Keys
 * with control characters or `<`/`>` are not legal in S3 object keys, so
 * a regex-based extractor is safe here.
 *
 * Done in a single pass so the output of one substitution never feeds another
 * (CodeQL js/incomplete-sanitization). For example a literal `&amp;lt;` in
 * the source decodes to the literal `&lt;`, not to `<`.
 */
function decodeXmlText(s: string): string {
  const map: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_match, name: string) => map[name] ?? _match);
}

async function listObjectsPage(
  config: R2PresignConfig,
  prefix: string,
  continuationToken: string | undefined,
): Promise<ListResult> {
  const query: Record<string, string> = {
    "list-type": "2",
    prefix,
  };
  if (continuationToken) {
    query["continuation-token"] = continuationToken;
  }

  const url = presignR2Url(config, "GET", "", PRESIGN_TTL_SECONDS, { query });
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable body>");
    throw new Error(`ListObjectsV2 failed: HTTP ${res.status} ${res.statusText} — ${body}`);
  }
  const xml = await res.text();

  const keys: string[] = [];
  const keyRegex = /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<\/Contents>/g;
  let m: RegExpExecArray | null;
  while ((m = keyRegex.exec(xml)) !== null) {
    keys.push(decodeXmlText(m[1]));
  }

  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
  let nextContinuationToken: string | undefined;
  if (truncated) {
    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    nextContinuationToken = tokenMatch ? decodeXmlText(tokenMatch[1]) : undefined;
  }

  return { keys, nextContinuationToken };
}

async function getObject(config: R2PresignConfig, key: string): Promise<Uint8Array<ArrayBuffer>> {
  const url = presignR2Url(config, "GET", key, PRESIGN_TTL_SECONDS);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable body>");
    throw new Error(`GetObject ${key} failed: HTTP ${res.status} ${res.statusText} — ${body}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf) as Uint8Array<ArrayBuffer>;
}

async function putObject(
  config: R2PresignConfig,
  key: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<void> {
  const url = presignR2Url(config, "PUT", key, PRESIGN_TTL_SECONDS, {
    signedHeaders: { "content-type": contentType },
  });
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "<unreadable body>");
    throw new Error(`PutObject ${key} failed: HTTP ${res.status} ${res.statusText} — ${errBody}`);
  }
}

// ── Main ──

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Validate environment
  const oldKeyHex = process.env.PHI_ENCRYPTION_KEY_OLD;
  const newKeyHex = process.env.PHI_ENCRYPTION_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!oldKeyHex || !newKeyHex) {
    console.error("ERROR: Both PHI_ENCRYPTION_KEY and PHI_ENCRYPTION_KEY_OLD must be set.");
    console.error("  PHI_ENCRYPTION_KEY     = new key (will be used for re-encryption)");
    console.error("  PHI_ENCRYPTION_KEY_OLD = old key (will be used for decryption)");
    process.exit(1);
  }

  if (oldKeyHex === newKeyHex) {
    console.error("ERROR: Old and new keys are identical. Nothing to rotate.");
    process.exit(1);
  }

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error(
      "ERROR: R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
    );
    process.exit(1);
  }

  const config: R2PresignConfig = { accountId, accessKeyId, secretAccessKey, bucketName };

  console.log("PHI Key Rotation Script");
  console.log("=======================");
  console.log(`Bucket: ${bucketName}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("");

  // Import keys
  const oldKey = await importKey(oldKeyHex);
  const newKey = await importKey(newKeyHex);
  console.log("Keys imported successfully.");

  // List all .enc files under clinics/
  console.log(`\nScanning ${ROOT_PREFIX}* for encrypted PHI files...`);

  const encFiles: string[] = [];
  let continuationToken: string | undefined;

  do {
    const { keys, nextContinuationToken } = await listObjectsPage(
      config,
      ROOT_PREFIX,
      continuationToken,
    );

    for (const key of keys) {
      if (isPHIFile(key)) {
        encFiles.push(key);
      }
    }

    continuationToken = nextContinuationToken;
  } while (continuationToken);

  console.log(`Found ${encFiles.length} encrypted PHI file(s).`);

  if (encFiles.length === 0) {
    console.log("No files to rotate. Done.");
    return;
  }

  // Process files
  let succeeded = 0;
  let failed = 0;
  const failures: { key: string; error: string }[] = [];

  for (let i = 0; i < encFiles.length; i++) {
    const key = encFiles[i];
    const progress = `[${i + 1}/${encFiles.length}]`;

    try {
      if (dryRun) {
        console.log(`${progress} Would re-encrypt: ${key}`);
        succeeded++;
        continue;
      }

      // Download
      const encrypted = await getObject(config, key);

      // Decrypt with old key
      const plaintext = await decryptWithKey(encrypted, oldKey);

      // Re-encrypt with new key
      const reEncrypted = await encryptWithKey(plaintext, newKey);

      // Upload back
      await putObject(config, key, reEncrypted, "application/octet-stream");

      succeeded++;
      console.log(`${progress} Re-encrypted: ${key}`);
    } catch (err) {
      failed++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      failures.push({ key, error: errorMsg });
      console.error(`${progress} FAILED: ${key} — ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n=======================");
  console.log("Rotation Summary");
  console.log("=======================");
  console.log(`Total files:     ${encFiles.length}`);
  console.log(`Succeeded:       ${succeeded}`);
  console.log(`Failed:          ${failed}`);

  if (failures.length > 0) {
    console.log("\nFailed files (retry manually):");
    for (const f of failures) {
      console.log(`  ${f.key}: ${f.error}`);
    }
    console.log(
      "\nWARNING: Do NOT remove PHI_ENCRYPTION_KEY_OLD until all files are re-encrypted.",
    );
    process.exit(1);
  }

  if (!dryRun) {
    console.log("\nAll files re-encrypted successfully!");
    console.log("Next steps:");
    console.log("  1. Remove PHI_ENCRYPTION_KEY_OLD from your environment");
    console.log("  2. Update Cloudflare Worker secrets: wrangler secret put PHI_ENCRYPTION_KEY");
    console.log("  3. Record this rotation in your audit log (date, operator, file count)");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
