import { get } from "@/lib/api-client";
import type { NotificationLogEntry } from "@/lib/notifications";
import type { WhatsAppTemplate } from "@/lib/whatsapp";

export interface QueueItem {
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

export interface QueueStatus {
  pending: number;
  failed: number;
  deadLettered: number;
  items: QueueItem[];
}

export interface NotificationDashboardData {
  templates: WhatsAppTemplate[];
  recentLogs: NotificationLogEntry[];
  queueStatus: QueueStatus;
}

export async function fetchNotificationDashboardData(
  clinicId: string,
): Promise<NotificationDashboardData> {
  return get<NotificationDashboardData>("/api/admin/notifications", {
    headers: {
      "x-clinic-id": clinicId,
    },
  });
}
