import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { executeReport, convertToCSV } from "@/lib/reports/builder";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const reportSchema = z.object({
  dataSource: z.enum(["appointments", "patients", "payments", "prescriptions"]),
  fields: z.array(z.string().max(50)).min(1).max(20),
  filters: z
    .array(
      z.object({
        field: z.string().max(50),
        operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in"]),
        value: z.union([z.string(), z.number(), z.array(z.string())]),
      }),
    )
    .max(10)
    .default([]),
  orderBy: z
    .object({
      field: z.string().max(50),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  exportFormat: z.enum(["json", "csv"]).default("json"),
});

async function handler(request: NextRequest, auth: AuthContext) {
  const body: unknown = await request.json().catch(() => null);
  if (!body) {
    return apiValidationError("Invalid JSON body");
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic context", 403);
  }

  const definition = { ...parsed.data, clinicId };

  try {
    const result = await executeReport(auth.supabase, definition);

    await logAuditEvent({
      supabase: auth.supabase,
      type: "admin",
      action: "execute_custom_report",
      clinicId,
      actor: auth.user.id,
      metadata: {
        dataSource: definition.dataSource,
        fields: definition.fields,
        totalRows: result.totalRows,
      },
    });

    if (definition.exportFormat === "csv") {
      const csv = convertToCSV(result);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${Date.now()}.csv"`,
        },
      });
    }

    return apiSuccess(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report execution failed";
    return apiError(message, 400);
  }
}

export const POST = withAuth(handler, ["clinic_admin", "super_admin"]);
