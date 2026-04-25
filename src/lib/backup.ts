/**
 * Backup & Restore Module
 *
 * Exports Supabase data (appointments, patients, invoices, products) to JSON
 * and provides restore functionality. Designed for clinic-level data backup.
 *
 * The backup runs on the server side via API routes and stores
 * backups either as downloadable JSON or to a configured storage bucket.
 */

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import type { Database } from "@/lib/types/database";

// ---- Types ----

export interface BackupManifest {
  version: string;
  createdAt: string;
  clinicId: string;
  clinicName: string;
  tables: BackupTableInfo[];
  totalRecords: number;
  truncated?: boolean;
  truncatedAt?: number;
}

interface BackupTableInfo {
  name: string;
  recordCount: number;
}

export interface BackupData {
  manifest: BackupManifest;
  data: Record<string, Record<string, unknown>[]>;
}

// Tables to back up per clinic
const BACKUP_TABLES = [
  "users",
  "appointments",
  "medical_records",
  "prescriptions",
  "invoices",
  "invoice_items",
  "products",
  "notifications",
  "treatment_plans",
] as const;

/** Maximum rows per table to prevent OOM on large clinics (HIGH-04). */
const MAX_ROWS_PER_TABLE = 10_000;

/** Maximum allowed size (in bytes) for a restore payload to prevent OOM. */
const MAX_RESTORE_PAYLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Explicit foreign key mapping per table (HIGH-02).
 * Only these columns will be remapped during restore — no naming-convention guessing.
 */
const FK_COLUMNS: Record<string, string[]> = {
  users: [],
  appointments: ["patient_id", "doctor_id", "service_id"],
  medical_records: ["patient_id", "doctor_id", "appointment_id"],
  prescriptions: ["patient_id", "doctor_id", "appointment_id"],
  invoices: ["patient_id", "appointment_id"],
  invoice_items: ["invoice_id", "product_id"],
  products: [],
  notifications: ["user_id"],
  treatment_plans: ["patient_id", "doctor_id"],
};

// ---- Export (Backup) ----

/**
 * Create a full backup of a clinic's data.
 */
export async function createBackup(
  clinicId: string,
  clinicName: string,
): Promise<BackupData> {
  const supabase = await createClient();
  const data: Record<string, Record<string, unknown>[]> = {};
  const tables: BackupTableInfo[] = [];
  let totalRecords = 0;
  let isTruncated = false;
  let truncatedAtRecord = 0;

  // Hard cap for total bytes to prevent lambda OOM during JSON serialization
  const MAX_TOTAL_RECORDS = 50_000;

  for (const table of BACKUP_TABLES) {
    let tableRows: Record<string, unknown>[] = [];
    let hasMore = true;
    let offset = 0;
    const limit = 1000; // Fetch in chunks

    while (hasMore) {
      // If we exceed the safety cap, abort fetching further rows
      if (totalRecords + tableRows.length >= MAX_TOTAL_RECORDS) {
        isTruncated = true;
        truncatedAtRecord = totalRecords + tableRows.length;
        hasMore = false;
        break;
      }

      const { data: chunk, error } = await supabase
        .from(table)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.warn("Backup: failed to fetch table chunk", { context: "backup", table, error });
        break;
      }

      if (!chunk || chunk.length === 0) {
        hasMore = false;
      } else {
        tableRows = tableRows.concat(chunk);
        offset += limit;
        if (chunk.length < limit) {
          hasMore = false; // Last page
        }
      }
    }

    data[table] = tableRows;
    const count = tableRows.length;
    tables.push({ name: table, recordCount: count });
    totalRecords += count;

    if (isTruncated) {
      logger.warn("Backup truncated due to size limits", { context: "backup", clinicId, truncatedAtRecord });
      break; // Stop processing further tables
    }
  }

  const manifest: BackupManifest = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    clinicId,
    clinicName,
    tables,
    totalRecords,
  };

  if (isTruncated) {
    manifest.truncated = true;
    manifest.truncatedAt = truncatedAtRecord;
  }

  return { manifest, data };
}

/**
 * Generate a downloadable backup as a JSON string.
 */
export async function generateBackupJson(
  clinicId: string,
  clinicName: string,
): Promise<string> {
  const backup = await createBackup(clinicId, clinicName);
  // FIX (HIGH-04): Omit pretty-printing to reduce memory footprint.
  return JSON.stringify(backup);
}

// ---- Import (Restore) ----

/**
 * Validate a backup file before restoring.
 */
export function validateBackup(
  json: string,
): { valid: boolean; manifest?: BackupManifest; parsed?: BackupData; error?: string } {
  try {
    const parsed = JSON.parse(json) as BackupData;

    if (!parsed.manifest?.version) {
      return { valid: false, error: "Invalid backup format: missing manifest" };
    }

    if (!parsed.manifest.clinicId) {
      return { valid: false, error: "Invalid backup: missing clinic ID" };
    }

    if (!parsed.data || typeof parsed.data !== "object") {
      return { valid: false, error: "Invalid backup: missing data section" };
    }

    return { valid: true, manifest: parsed.manifest, parsed };
  } catch (err) {
    logger.warn("Backup validation failed: invalid JSON", { context: "backup", error: err });
    return { valid: false, error: "Invalid JSON format" };
  }
}

/**
 * Restore data from a backup into a clinic.
 * Uses upsert to avoid duplicates (based on primary key 'id').
 *
 * IMPORTANT: This is a destructive operation. Only allow clinic admins
 * to perform restores, and always create a new backup before restoring.
 */
export async function restoreBackup(
  json: string,
  targetClinicId: string,
  callerRole?: string,
): Promise<{
  success: boolean;
  restored: BackupTableInfo[];
  errors: string[];
  warnings: string[];
}> {
  // Authorization: only clinic_admin or super_admin may restore backups
  if (callerRole !== "clinic_admin" && callerRole !== "super_admin") {
    return { success: false, restored: [], errors: ["Unauthorized: only clinic admins can restore backups"], warnings: [] };
  }

  // Guard against excessively large payloads that could cause OOM
  const byteLength = Buffer.byteLength(json, "utf8");
  if (byteLength > MAX_RESTORE_PAYLOAD_BYTES) {
    return {
      success: false,
      restored: [],
      errors: [`Backup payload too large (${(byteLength / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${MAX_RESTORE_PAYLOAD_BYTES / 1024 / 1024} MB.`],
      warnings: [],
    };
  }

  const validation = validateBackup(json);
  if (!validation.valid) {
    return { success: false, restored: [], errors: [validation.error!], warnings: [] };
  }

  // Reuse the already-parsed object from validation to avoid double JSON.parse
  const backup = validation.parsed!;
  const supabase = await createClient();
  const restored: BackupTableInfo[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---- Pass 1: Generate all new IDs upfront ----
  // This avoids forward-reference breakage when table A references an
  // ID from table B that appears later in BACKUP_TABLES.
  const idMap = new Map<string, string>();

  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table];
    if (!rows) continue;
    for (const row of rows) {
      const oldId = row.id as string | undefined;
      if (oldId) {
        idMap.set(oldId, crypto.randomUUID());
      }
    }
  }

  // ---- Pass 2: Remap IDs + FK references, then insert ----
  // HIGH-06: Prepare all mapped rows first, then insert via a single
  // Supabase RPC call wrapped in a database transaction. This ensures
  // atomicity: if any table fails, the entire restore is rolled back
  // instead of leaving partially-restored (corrupt) state.
  const allMappedRows: Record<string, Record<string, unknown>[]> = {};

  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table];
    if (!rows || rows.length === 0) {
      allMappedRows[table] = [];
      continue;
    }

    allMappedRows[table] = rows.map((row) => {
      const mapped: Record<string, unknown> = { ...row };

      // Assign the pre-generated new ID
      const oldId = row.id as string | undefined;
      mapped.id = oldId ? idMap.get(oldId) : crypto.randomUUID();
      mapped.clinic_id = targetClinicId;

      // Strip sensitive fields from user records to prevent privilege escalation.
      // WARNING: All restored users are reset to "patient" role regardless of
      // their original role. Doctors, admins, and other staff will need their
      // roles re-assigned manually after restore.
      if (table === "users") {
        const originalRole = mapped.role as string | undefined;
        delete mapped.auth_id;
        delete mapped.role;
        mapped.role = "patient";
        if (originalRole && originalRole !== "patient") {
          warnings.push(
            `User "${mapped.name ?? mapped.id}" had role "${originalRole}" — reset to "patient" for security. Re-assign manually.`,
          );
        }
      }

      // FIX (HIGH-02): Use explicit FK mapping instead of fragile _id suffix
      // convention that causes false positives (e.g. external_system_id).
      const fkCols = FK_COLUMNS[table] ?? [];
      for (const col of fkCols) {
        const value = mapped[col];
        if (typeof value === "string" && idMap.has(value)) {
          mapped[col] = idMap.get(value);
        }
      }

      return mapped;
    });
  }

  // Try transactional restore via RPC first (atomic, all-or-nothing).
  // Falls back to sequential inserts if the RPC function does not exist.
  // Note: restore_backup_transaction is not yet in the generated Supabase
  // types. The type assertion below allows calling it without suppressing
  // all type safety via `as any`. Once the RPC is added to the DB and types
  // are regenerated, remove the assertion.
  const rpcClient = supabase.rpc as (
    fn: string,
    args: { backup_data: string; target_clinic: string },
  ) => ReturnType<typeof supabase.rpc>;
  const { error: rpcError } = await rpcClient("restore_backup_transaction", {
    backup_data: JSON.stringify(allMappedRows),
    target_clinic: targetClinicId,
  });

  if (!rpcError) {
    // RPC succeeded — all tables were restored atomically
    for (const table of BACKUP_TABLES) {
      restored.push({
        name: table,
        recordCount: allMappedRows[table]?.length ?? 0,
      });
    }
  } else if (rpcError.message?.includes("function") && rpcError.message?.includes("does not exist")) {
    // Fallback: RPC function not deployed yet — use sequential inserts
    // (non-atomic, but preserves existing behavior)
    logger.warn(
      "restore_backup_transaction RPC not found — falling back to non-atomic sequential inserts. " +
      "Deploy the RPC function to enable atomic restores.",
      { context: "backup/restore", rpcError: rpcError.message },
    );
    for (const table of BACKUP_TABLES) {
      const mappedRows = allMappedRows[table];
      if (!mappedRows || mappedRows.length === 0) {
        restored.push({ name: table, recordCount: 0 });
        continue;
      }

      const { error } = await supabase.from(table)
        .insert(mappedRows as Database["public"]["Tables"][typeof table]["Insert"][]);

      if (error) {
        errors.push(`${table}: ${error.message}`);
        restored.push({ name: table, recordCount: 0 });
      } else {
        restored.push({ name: table, recordCount: mappedRows.length });
      }
    }
  } else {
    // RPC exists but failed — report the error
    errors.push(`Transaction failed: ${rpcError.message}`);
    for (const table of BACKUP_TABLES) {
      restored.push({ name: table, recordCount: 0 });
    }
  }

  return {
    success: errors.length === 0,
    restored,
    errors,
    warnings,
  };
}
