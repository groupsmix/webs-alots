/**
 * Backup & Restore Module
 *
 * Exports Supabase data (appointments, patients, invoices, products) to JSON
 * and provides restore functionality. Designed for clinic-level data backup.
 *
 * The backup runs on the server side via API routes and stores
 * backups either as downloadable JSON or to a configured storage bucket.
 */

import { createClient } from "@/lib/supabase-server";

// ---- Types ----

export interface BackupManifest {
  version: string;
  createdAt: string;
  clinicId: string;
  clinicName: string;
  tables: BackupTableInfo[];
  totalRecords: number;
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

  // Fetch all tables in parallel instead of sequentially
  const results = await Promise.all(
    BACKUP_TABLES.map((table) =>
      supabase.from(table)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .then(({ data: rows, error }) => ({ table, rows, error })),
    ),
  );

  for (const { table, rows, error } of results) {
    if (error) {
      console.error(`[Backup] Failed to export ${table}:`, error.message);
      data[table] = [];
      tables.push({ name: table, recordCount: 0 });
      continue;
    }

    data[table] = (rows ?? []) as Record<string, unknown>[];
    const count = data[table].length;
    tables.push({ name: table, recordCount: count });
    totalRecords += count;
  }

  const manifest: BackupManifest = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    clinicId,
    clinicName,
    tables,
    totalRecords,
  };

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
  return JSON.stringify(backup, null, 2);
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
  } catch {
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
}> {
  // Authorization: only clinic_admin or super_admin may restore backups
  if (callerRole !== "clinic_admin" && callerRole !== "super_admin") {
    return { success: false, restored: [], errors: ["Unauthorized: only clinic admins can restore backups"] };
  }

  const validation = validateBackup(json);
  if (!validation.valid) {
    return { success: false, restored: [], errors: [validation.error!] };
  }

  // Reuse the already-parsed object from validation to avoid double JSON.parse
  const backup = validation.parsed!;
  const supabase = await createClient();
  const restored: BackupTableInfo[] = [];
  const errors: string[] = [];

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
  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table];
    if (!rows || rows.length === 0) {
      restored.push({ name: table, recordCount: 0 });
      continue;
    }

    const mappedRows = rows.map((row) => {
      const mapped: Record<string, unknown> = { ...row };

      // Assign the pre-generated new ID
      const oldId = row.id as string | undefined;
      mapped.id = oldId ? idMap.get(oldId) : crypto.randomUUID();
      mapped.clinic_id = targetClinicId;

      // Strip sensitive fields from user records to prevent privilege escalation
      if (table === "users") {
        delete mapped.auth_id;
        delete mapped.role;
        mapped.role = "patient"; // Default restored users to patient role
      }

      // Auto-detect foreign key columns by the `_id` suffix convention
      // instead of maintaining a hardcoded list that can drift from
      // the actual schema.
      for (const [key, value] of Object.entries(mapped)) {
        if (
          key !== "id" &&
          key !== "clinic_id" &&
          key !== "auth_id" &&
          key.endsWith("_id") &&
          typeof value === "string" &&
          idMap.has(value)
        ) {
          mapped[key] = idMap.get(value);
        }
      }

      return mapped;
    });

    const { error } = await supabase.from(table)
      .insert(mappedRows as never[]);

    if (error) {
      errors.push(`${table}: ${error.message}`);
      restored.push({ name: table, recordCount: 0 });
    } else {
      restored.push({ name: table, recordCount: mappedRows.length });
    }
  }

  return {
    success: errors.length === 0,
    restored,
    errors,
  };
}
