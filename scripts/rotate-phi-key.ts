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
 * See src/lib/encryption.ts for the full key rotation procedure.
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

// ── Configuration ──

// We list from the "clinics/" prefix and filter for .enc files
const ROOT_PREFIX = "clinics/";

const IV_LENGTH = 12; // 96-bit IV for AES-GCM

// ── Helpers ──

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))) as Uint8Array<ArrayBuffer>;
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

async function decryptWithKey(encrypted: Uint8Array<ArrayBuffer>, key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  if (encrypted.length < IV_LENGTH + 1) {
    throw new Error("Encrypted data too short");
  }
  const iv = new Uint8Array(encrypted.slice(0, IV_LENGTH)) as Uint8Array<ArrayBuffer>;
  const ciphertext = new Uint8Array(encrypted.slice(IV_LENGTH)) as Uint8Array<ArrayBuffer>;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new Uint8Array(plaintext) as Uint8Array<ArrayBuffer>;
}

async function encryptWithKey(plaintext: Uint8Array<ArrayBuffer>, key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
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
    "documents", "prescriptions", "lab-results", "lab_results",
    "x-rays", "xrays", "medical-records", "medical_records",
    "patient-files", "patient_files",
  ];
  return categories.some((cat) => key.includes(`/${cat}/`));
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
    console.error("ERROR: R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).");
    process.exit(1);
  }

  console.log("PHI Key Rotation Script");
  console.log("=======================");
  console.log(`Bucket: ${bucketName}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("");

  // Import keys
  const oldKey = await importKey(oldKeyHex);
  const newKey = await importKey(newKeyHex);
  console.log("Keys imported successfully.");

  // Create S3 client
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  // List all .enc files under clinics/
  console.log(`\nScanning ${ROOT_PREFIX}* for encrypted PHI files...`);

  const encFiles: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: ROOT_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of response.Contents ?? []) {
      if (obj.Key && isPHIFile(obj.Key)) {
        encFiles.push(obj.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
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
      const getResponse = await client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: key }),
      );

      if (!getResponse.Body) {
        throw new Error("Empty response body");
      }

      const chunks: Uint8Array[] = [];
      const body = getResponse.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      const encrypted = new Uint8Array(
        chunks.reduce((acc, c) => acc + c.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        encrypted.set(chunk, offset);
        offset += chunk.length;
      }

      // Decrypt with old key
      const plaintext = await decryptWithKey(encrypted, oldKey);

      // Re-encrypt with new key
      const reEncrypted = await encryptWithKey(plaintext, newKey);

      // Upload back
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: reEncrypted,
          ContentType: "application/octet-stream",
        }),
      );

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
    console.log("\nWARNING: Do NOT remove PHI_ENCRYPTION_KEY_OLD until all files are re-encrypted.");
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
