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

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await supabase.from(table)
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

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
): { valid: boolean; manifest?: BackupManifest; error?: string } {
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

    return { valid: true, manifest: parsed.manifest };
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
): Promise<{
  success: boolean;
  restored: BackupTableInfo[];
  errors: string[];
}> {
  const validation = validateBackup(json);
  if (!validation.valid) {
    return { success: false, restored: [], errors: [validation.error!] };
  }

  const backup = JSON.parse(json) as BackupData;
  const supabase = await createClient();
  const restored: BackupTableInfo[] = [];
  const errors: string[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table];
    if (!rows || rows.length === 0) {
      restored.push({ name: table, recordCount: 0 });
      continue;
    }

    // Override clinic_id to target clinic
    const mappedRows = rows.map((row) => ({
      ...row,
      clinic_id: targetClinicId,
    }));

    const { error } = await supabase.from(table)
      .upsert(mappedRows, { onConflict: "id" });

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
