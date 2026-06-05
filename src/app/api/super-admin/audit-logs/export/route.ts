/**
 * GET /api/super-admin/audit-logs/export
 *
 * Returns a CSV of audit log entries matching the same filters as the
 * audit-logs page (event, from, to). Capped at 10 000 rows.
 * Only super_admin may call this endpoint.
 */

import { type NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthContext } from "@/lib/with-auth";

export const GET = withAuth(
  async (request: NextRequest, { supabase }: AuthContext) => {
    const sp = request.nextUrl.searchParams;
    const event = sp.get("event")?.trim() || undefined;
    const from = sp.get("from")?.trim() || undefined;
    const to = sp.get("to")?.trim() || undefined;

    // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant export
    let query = supabase
      .from("activity_logs")
      .select("id, timestamp, action, actor, type, description, clinic_name")
      .order("timestamp", { ascending: false })
      .limit(10_000);

    if (event) query = query.ilike("action", `%${event}%`);
    if (from) query = query.gte("timestamp", from);
    if (to) query = query.lte("timestamp", `${to}T23:59:59Z`);

    const { data } = await query;
    const rows = data ?? [];

    // SECURITY: CSV formula injection. A cell whose first character is
    // =, +, -, @, or a TAB/CR will be evaluated as a formula by Excel and
    // Google Sheets. Prefix such values with a single quote so the value
    // is rendered as plain text. Mirrors src/lib/export-data.ts.
    const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);
    const esc = (v: string | null | undefined): string => {
      let str = String(v ?? "");
      if (str.length > 0 && FORMULA_PREFIXES.has(str[0])) {
        str = `'${str}`;
      }
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const header = "timestamp,actor,clinic,action,type,description\n";
    const body = rows
      .map((r) =>
        [
          esc(r.timestamp),
          esc(r.actor),
          esc(r.clinic_name),
          esc(r.action),
          esc(r.type),
          esc(r.description),
        ].join(","),
      )
      .join("\n");

    return new NextResponse(header + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-log.csv"',
        "Cache-Control": "no-store",
      },
    });
  },
  ["super_admin"],
);
