/**
 * Custom report builder engine.
 *
 * Allows clinic admins to define ad-hoc reports by selecting fields,
 * filters, grouping, and export format — all scoped to clinic_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportDataSource = "appointments" | "patients" | "payments" | "prescriptions";

export type ExportFormat = "json" | "csv";

export interface ReportFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in";
  value: string | number | string[];
}

export interface ReportDefinition {
  clinicId: string;
  dataSource: ReportDataSource;
  fields: string[];
  filters: ReportFilter[];
  orderBy?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  exportFormat: ExportFormat;
}

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  generatedAt: string;
}

// ─── Allowed fields per data source (prevents injection) ─────────────────────

const ALLOWED_FIELDS: Record<ReportDataSource, Set<string>> = {
  appointments: new Set([
    "id",
    "patient_id",
    "doctor_id",
    "status",
    "slot_start",
    "slot_end",
    "appointment_type",
    "created_at",
  ]),
  patients: new Set(["id", "name", "phone", "email", "created_at", "date_of_birth", "gender"]),
  payments: new Set(["id", "patient_id", "amount", "status", "category", "created_at"]),
  prescriptions: new Set([
    "id",
    "patient_id",
    "doctor_id",
    "drug_name",
    "dose",
    "status",
    "created_at",
  ]),
};

// ─── Implementation ──────────────────────────────────────────────────────────

export async function executeReport(
  supabase: SupabaseClient<Database>,
  definition: ReportDefinition,
): Promise<ReportResult> {
  const { clinicId, dataSource, fields, filters, orderBy, limit } = definition;

  const allowedFields = ALLOWED_FIELDS[dataSource];
  if (!allowedFields) {
    throw new Error(`Invalid data source: ${dataSource}`);
  }

  const safeFields = fields.filter((f) => allowedFields.has(f));
  if (safeFields.length === 0) {
    throw new Error("No valid fields selected");
  }

  const selectStr = safeFields.join(", ");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from(dataSource)
    .select(selectStr, { count: "exact" })
    .eq("clinic_id", clinicId);

  for (const filter of filters) {
    if (!allowedFields.has(filter.field)) continue;

    switch (filter.operator) {
      case "eq":
        query = query.eq(filter.field, filter.value);
        break;
      case "neq":
        query = query.neq(filter.field, filter.value);
        break;
      case "gt":
        query = query.gt(filter.field, filter.value);
        break;
      case "gte":
        query = query.gte(filter.field, filter.value);
        break;
      case "lt":
        query = query.lt(filter.field, filter.value);
        break;
      case "lte":
        query = query.lte(filter.field, filter.value);
        break;
      case "in":
        if (Array.isArray(filter.value)) {
          query = query.in(filter.field, filter.value);
        }
        break;
    }
  }

  if (orderBy && allowedFields.has(orderBy.field)) {
    query = query.order(orderBy.field, { ascending: orderBy.direction === "asc" });
  }

  if (limit && limit > 0 && limit <= 10000) {
    query = query.limit(limit);
  } else {
    query = query.limit(1000);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Report query failed: ${error.message}`);
  }

  return {
    columns: safeFields,
    rows: (data ?? []) as Record<string, unknown>[],
    totalRows: count ?? 0,
    generatedAt: new Date().toISOString(),
  };
}

export function convertToCSV(result: ReportResult): string {
  if (result.rows.length === 0) return result.columns.join(",") + "\n";

  const header = result.columns.join(",");
  const rows = result.rows.map((row) =>
    result.columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(","),
  );

  return [header, ...rows].join("\n") + "\n";
}
