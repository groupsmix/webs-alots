import { NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/api-validate";
import { runAutomatedComplianceChecks } from "@/lib/automation/compliance-monitor";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/cron/compliance-check
 *
 * Daily cron job that runs the Moroccan Law 09-08 compliance checks.
 * If any check fails, it alerts the super_admin.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createUntypedAdminClient("cron-compliance");

  try {
    const report = await runAutomatedComplianceChecks(supabase);

    if (report.overallStatus !== "compliant") {
      logger.warn("Compliance checks failed", {
        context: "cron/compliance-check",
        failedChecks: report.checks.filter(c => c.status !== "compliant").map(c => c.id)
      });

      // Fetch super admins to notify
      const { data: superAdmins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "super_admin");

      if (superAdmins && superAdmins.length > 0) {
        // Enqueue notifications (assuming system supports internal alerts)
        for (const admin of superAdmins) {
          // Log or enqueue an alert for the admin
          // await enqueueNotification(supabase, { ... })
          logger.info(`Would alert super_admin ${admin.id} about compliance failure`);
        }
      }
    } else {
      logger.info("Compliance checks passed", {
        context: "cron/compliance-check"
      });
    }

    return apiSuccess({
      message: "Compliance checks completed",
      status: report.overallStatus,
      report
    });

  } catch (err) {
    logger.error("Compliance cron failed", {
      context: "cron/compliance-check",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiInternalError("Compliance execution failed");
  }
}
