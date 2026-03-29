/**
 * GDPR Data Export API — Right to Portability
 *
 * Allows authenticated patients to download all their personal data
 * in JSON or CSV format. Supports GDPR Article 20 and Loi 09-08.
 *
 * GET /api/patient/export?format=json|csv
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";

/** Characters that trigger formula execution in Excel/Google Sheets. */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Neutralise formula injection: prefix with a single quote so the value
  // is treated as plain text by spreadsheet applications.
  if (str.length > 0 && FORMULA_PREFIXES.has(str[0])) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCSV).join(",");
  const body = rows.map((row) =>
    columns.map((col) => escapeCSV(row[col])).join(","),
  );
  return [header, ...body].join("\n");
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format. Use 'json' or 'csv'." },
      { status: 400 },
    );
  }

  // Authenticate via Supabase session cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user profile — select only needed columns
  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, phone, role, created_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch patient-related data
  const [
    { data: appointments },
    { data: prescriptions },
    { data: payments },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, slot_start, slot_end, status, notes, source, is_first_visit, insurance_flag, created_at")
      .eq("patient_id", profile.id)
      .order("slot_start", { ascending: false }),
    supabase
      .from("prescriptions")
      .select("id, medication, dosage, duration, instructions, created_at")
      .eq("patient_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, method, status, ref, created_at")
      .eq("patient_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, name, category, created_at")
      .eq("patient_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  const exportData = {
    exportDate: new Date().toISOString(),
    personalInfo: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      createdAt: profile.created_at,
    },
    appointments: appointments ?? [],
    prescriptions: prescriptions ?? [],
    payments: payments ?? [],
    documents: documents ?? [],
  };

  // Log the export for GDPR/Loi 09-08 audit trail
  try {
    await supabase.from("activity_logs").insert({
      action: "patient_data_exported",
      type: "patient",
      actor: profile.id,
      clinic_id: null,
      description: `Patient exported personal data in ${format} format`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Failed to log data export audit event", { context: "patient/export", error: err });
  }

  if (format === "json") {
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  }

  // CSV format — flatten into a single summary CSV
  const rows = [
    ...(appointments ?? []).map((a) => ({
      type: "appointment",
      id: a.id,
      date: a.slot_start,
      status: a.status,
      details: a.notes ?? "",
      amount: "",
    })),
    ...(prescriptions ?? []).map((p) => ({
      type: "prescription",
      id: p.id,
      date: p.created_at,
      status: "",
      details: `${p.medication} - ${p.dosage}`,
      amount: "",
    })),
    ...(payments ?? []).map((pay) => ({
      type: "payment",
      id: pay.id,
      date: pay.created_at,
      status: pay.status,
      details: pay.method,
      amount: String(pay.amount),
    })),
  ];

  const csv = toCSV(rows, ["type", "id", "date", "status", "details", "amount"]);

  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
