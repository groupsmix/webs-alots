import { apiError } from "@/lib/api-response";
import { buildSlaReportHtml, getSlaReportSnapshot } from "@/lib/system-status";
import { withAuth } from "@/lib/with-auth";

function parseMonth(raw: string | null): string | null {
  if (!raw) return null;
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

export const GET = withAuth(async (request, auth) => {
  if (auth.profile.role !== "super_admin") {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  const month = parseMonth(request.nextUrl.searchParams.get("month")) ??
    new Date().toISOString().slice(0, 7);
  const report = await getSlaReportSnapshot(month);

  return new Response(buildSlaReportHtml(report), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="sla-report-${month}.html"`,
    },
  });
}, ["super_admin"]);
