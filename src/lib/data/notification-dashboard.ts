import type { NotificationDashboardData } from "@/lib/data/client/notification-dashboard";
import type { NotificationLogEntry } from "@/lib/notifications";
import { createTenantClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";
import type { WhatsAppTemplate } from "@/lib/whatsapp";

interface QueueItem {
  id: string;
  status: "pending" | "failed";
  attempts: number;
  next_attempt_at: string;
  error_message: string | null;
  channel: string;
  recipient: string;
  created_at: string;
  payload: Record<string, unknown>;
}

interface QueueStatus {
  pending: number;
  failed: number;
  deadLettered: number;
  items: QueueItem[];
}

function toNotificationLogEntry(row: Tables<"notification_log">): NotificationLogEntry {
  return {
    id: row.id,
    trigger: row.trigger as NotificationLogEntry["trigger"],
    channel: row.channel as NotificationLogEntry["channel"],
    recipientId: row.recipient_phone ?? "",
    recipientName: row.recipient_name ?? "Unknown",
    recipientRole: "",
    title: "",
    body: row.body ?? "",
    status: row.status as NotificationLogEntry["status"],
    priority: "normal" as NotificationLogEntry["priority"],
    metadata: undefined,
    createdAt: row.created_at ?? "",
    sentAt: undefined,
    readAt: undefined,
    error: row.error_message ?? undefined,
  };
}

export async function fetchNotificationDashboardData(
  clinicId: string,
): Promise<NotificationDashboardData> {
  const supabase = await createTenantClient(clinicId);

  // prettier-ignore
  // @ts-expect-error -- Supabase generated types lag behind actual DB schema
  const templatesResult = await supabase.from("whatsapp_templates").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
  const templates = (templatesResult.data ?? []) as WhatsAppTemplate[];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentLogsResult = await supabase
    .from("notification_log")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  const recentLogs = ((recentLogsResult.data ?? []) as Tables<"notification_log">[]).map(
    toNotificationLogEntry,
  );

  // prettier-ignore
  // @ts-expect-error -- Supabase generated types lag behind actual DB schema
  const queueResult = await supabase.from("notification_queue").select("id, status, attempts, next_attempt_at, error_message, channel, recipient, created_at, payload").eq("clinic_id", clinicId).in("status", ["pending", "failed"]).order("created_at", { ascending: false }).limit(50);
  const queueItems = (queueResult.data ?? []) as QueueItem[];

  const queueStatus: QueueStatus = {
    pending: 0,
    failed: 0,
    deadLettered: 0,
    items: queueItems,
  };

  for (const item of queueItems) {
    if (item.status === "pending") {
      queueStatus.pending++;
    } else if (item.status === "failed") {
      if (item.next_attempt_at?.startsWith("9999")) {
        queueStatus.deadLettered++;
      } else {
        queueStatus.failed++;
      }
    }
  }

  return {
    templates,
    recentLogs,
    queueStatus,
  };
}
