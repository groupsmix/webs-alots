/**
 * GDPR Data Export API — Right to Portability
 *
 * Allows authenticated patients to download all their personal data
 * in JSON or CSV format. Supports GDPR Article 20 and Loi 09-08.
 *
 * GET /api/patient/export?format=json|csv
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiNotFound } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";

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

export const GET = withAuth(async (request: NextRequest, { supabase, profile }) => {
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  if (format !== "json" && format !== "csv") {
    return apiError("Invalid format. Use 'json' or 'csv'.");
  }

  // Fetch full user profile for export — select only needed columns
  const { data: fullProfile } = await supabase
    .from("users")
    .select("id, name, email, phone, role, created_at")
    .eq("id", profile.id)
    .maybeSingle();

  if (!fullProfile) {
    return apiNotFound("Profile not found");
  }

  // A73-F3: Use streaming to prevent memory exhaustion for long-history patients.
  // Instead of Promise.all() loading everything into memory, we yield chunks.
  
  // Log the export for GDPR/Loi 09-08 audit trail
  try {
    await supabase.from("activity_logs").insert({
      action: "patient_data_exported",
      type: "patient",
      actor: profile.id,
      clinic_id: profile.clinic_id,
      description: `Patient exported personal data in ${format} format`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Failed to log data export audit event", { context: "patient/export", error: err });
  }

  const encoder = new TextEncoder();
  const PAGE_SIZE = 1000;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (format === "json") {
          controller.enqueue(encoder.encode(`{\n  "exportDate": "${new Date().toISOString()}",\n  "personalInfo": ${JSON.stringify(fullProfile)},\n`));
          
          const categories = [
            { key: "appointments", table: "appointments", select: "id, slot_start, slot_end, status, notes, source, is_first_visit, insurance_flag, created_at", order: "slot_start" },
            { key: "prescriptions", table: "prescriptions", select: "id, medication, dosage, duration, instructions, created_at", order: "created_at" },
            { key: "payments", table: "payments", select: "id, amount, method, status, ref, created_at", order: "created_at" },
            { key: "documents", table: "documents", select: "id, name, category, created_at", order: "created_at" }
          ];

          for (let i = 0; i < categories.length; i++) {
            const { key, table, select, order } = categories[i];
            controller.enqueue(encoder.encode(`  "${key}": [\n`));
            
            let offset = 0;
            let firstRow = true;
            while (true) {
              const { data } = await supabase
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .from(table as any)
                .select(select)
                .eq("patient_id", profile.id)
                .order(order, { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);
              
              if (!data || data.length === 0) break;
              
              for (const row of data) {
                if (!firstRow) controller.enqueue(encoder.encode(",\n"));
                controller.enqueue(encoder.encode(`    ${JSON.stringify(row)}`));
                firstRow = false;
              }
              
              if (data.length < PAGE_SIZE) break;
              offset += PAGE_SIZE;
            }
            
            controller.enqueue(encoder.encode(`\n  ]${i < categories.length - 1 ? "," : ""}\n`));
          }
          
          controller.enqueue(encoder.encode(`}\n`));
        } else {
          // CSV streaming
          controller.enqueue(encoder.encode("\uFEFFtype,id,date,status,details,amount\n"));
          
          // Appointments
          let offset = 0;
          while (true) {
            const { data } = await supabase.from("appointments").select("id, slot_start, status, notes").eq("patient_id", profile.id).order("slot_start", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
            if (!data || data.length === 0) break;
            const rows = data.map(a => ({ type: "appointment", id: a.id, date: a.slot_start, status: a.status, details: a.notes ?? "", amount: "" }));
            controller.enqueue(encoder.encode(toCSV(rows, ["type", "id", "date", "status", "details", "amount"]) + "\n"));
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }

          // Prescriptions
          offset = 0;
          while (true) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await supabase.from("prescriptions" as any).select("id, medication, dosage, created_at").eq("patient_id", profile.id).order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
            if (!data || data.length === 0) break;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows = data.map((p: any) => ({ type: "prescription", id: p.id, date: p.created_at, status: "", details: `${p.medication} - ${p.dosage}`, amount: "" }));
            controller.enqueue(encoder.encode(toCSV(rows, ["type", "id", "date", "status", "details", "amount"]) + "\n"));
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }

          // Payments
          offset = 0;
          while (true) {
            const { data } = await supabase.from("payments").select("id, amount, method, status, created_at").eq("patient_id", profile.id).order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
            if (!data || data.length === 0) break;
            const rows = data.map(pay => ({ type: "payment", id: pay.id, date: pay.created_at, status: pay.status, details: pay.method, amount: String(pay.amount) }));
            controller.enqueue(encoder.encode(toCSV(rows, ["type", "id", "date", "status", "details", "amount"]) + "\n"));
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }
      } catch (err) {
        logger.error("Error during streaming export", { context: "patient/export", error: err });
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": format === "json" ? "application/json" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().split("T")[0]}.${format}"`,
    },
  });
}, ["patient"]);
