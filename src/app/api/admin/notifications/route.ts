import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";
import { withAuth } from "@/lib/with-auth";

interface QueueItem {
  id: string;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  error_message: string | null;
  channel: string;
  recipient: string;
  created_at: string;
  payload: unknown;
}

export const GET = withAuth(async () => {
  const tenant = await getTenant();
  if (!tenant?.clinicId) return apiInternalError("Missing clinic context");
  const clinicId = tenant.clinicId;

  try {
    const supabase = await createTenantClient(clinicId);

    // 1. Fetch templates
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    const templatesResult = await supabase.from("whatsapp_templates").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
    const templates = templatesResult.data;

    // 2. Fetch recent logs (last 7 days, up to 100)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    const recentLogsResult = await supabase.from("notification_log").select("*").eq("clinic_id", clinicId).gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(100);
    const recentLogs = recentLogsResult.data;

    // 3. Fetch queue status (pending, failed, dead-lettered)
    // @ts-expect-error -- Supabase generated types lag behind actual DB schema
    const queueResult = await supabase.from("notification_queue").select("id, status, attempts, next_attempt_at, error_message, channel, recipient, created_at, payload").eq("clinic_id", clinicId).in("status", ["pending", "failed"]).order("created_at", { ascending: false }).limit(50);
    const queueItems = (queueResult.data ?? null) as QueueItem[] | null;

    const queueStatus = {
      pending: 0,
      failed: 0,
      deadLettered: 0,
      items: queueItems || [],
    };

    if (queueItems) {
      for (const item of queueItems) {
        if (item.status === "pending") queueStatus.pending++;
        else if (item.status === "failed") {
          // Check if dead lettered
          if (item.next_attempt_at?.startsWith("9999")) {
            queueStatus.deadLettered++;
          } else {
            queueStatus.failed++;
          }
        }
      }
    }

    return apiSuccess({
      templates: templates || [],
      recentLogs: recentLogs || [],
      queueStatus,
    });
  } catch (_error) {
    return apiInternalError("Failed to fetch notification data");
  }
}, ["clinic_admin", "super_admin"]);
