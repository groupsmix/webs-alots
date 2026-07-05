import type { ActivityLog } from "@/lib/super-admin/types";

type ActivityLogRow = {
  id: string;
  action: string | null;
  description: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  created_at: string | null;
  actor: string | null;
  type: string | null;
};

export function mapActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    action: row.action ?? "",
    description: row.description ?? "",
    clinicId: row.clinic_id ?? undefined,
    clinicName: row.clinic_name ?? undefined,
    timestamp: row.created_at ?? "",
    actor: row.actor ?? "System",
    type: (row.type ?? "clinic") as ActivityLog["type"],
  };
}
