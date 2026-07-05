import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import { mapActivityLog } from "@/lib/super-admin/helpers";
import type { ActivityLog, Announcement, AnnouncementInput } from "@/lib/super-admin/types";

type SuperAdminClient = Awaited<ReturnType<typeof createClient>>;

export interface DashboardStats {
  clinics: {
    id: string;
    name: string;
    type: string;
    tier: string | null;
    status: string | null;
    config: Record<string, unknown> | null;
    created_at: string | null;
  }[];
  totalClinics: number;
  activeClinics: number;
  totalPatients: number;
  totalAppointments: number;
  totalRevenue: number;
}

type AnnouncementRow = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  target: string | null;
  target_label: string | null;
  published_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
};

const ANNOUNCEMENT_COLUMNS =
  "id, title, message, type, target, target_label, published_at, expires_at, is_active, created_by, created_at";

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title ?? "",
    message: row.message ?? "",
    type: (row.type ?? "info") as Announcement["type"],
    target: row.target ?? "all",
    targetLabel: row.target_label ?? "All Clinics",
    publishedAt: (row.published_at ?? row.created_at ?? "").split("T")[0] ?? "",
    expiresAt: row.expires_at ? row.expires_at.split("T")[0] : undefined,
    active: row.is_active ?? true,
    createdBy: row.created_by ?? "System",
  };
}

async function logAnnouncementActivity(
  supabase: SuperAdminClient,
  action: string,
  description: string,
): Promise<void> {
  try {
    await supabase // nosemgrep: semgrep.tenant-scoping — global super-admin audit event; announcements are platform-wide (no clinic_id) so this audit row is not clinic-scoped
      .from("activity_logs")
      .insert({
        action,
        description,
        type: "announcement",
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn("Non-blocking audit log failed", { context: "super-admin-actions", error: err });
  }
}

export async function fetchDashboardStatsImpl(supabase: SuperAdminClient): Promise<DashboardStats> {
  const [clinicsRes, patientCountRes, appointmentCountRes, revenueRes] = await Promise.all([
    supabase.from("clinics").select("id, name, type, tier, status, config, created_at"),
    supabase.from("users").select("id", { count: "exact", head: true }).in("role", ["patient"]),
    supabase.from("appointments").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("amount").eq("status", "completed"),
  ]);

  const clinics = (clinicsRes.data ?? []) as DashboardStats["clinics"];
  const completedPayments = (revenueRes.data ?? []) as { amount: number }[];

  return {
    clinics,
    totalClinics: clinics.length,
    activeClinics: clinics.filter((clinic) => clinic.status === "active").length,
    totalPatients: patientCountRes.count ?? 0,
    totalAppointments: appointmentCountRes.count ?? 0,
    totalRevenue: completedPayments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0),
  };
}

export async function fetchAnnouncementsImpl(supabase: SuperAdminClient): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => mapAnnouncement(row as AnnouncementRow));
}

export async function createAnnouncementImpl(
  supabase: SuperAdminClient,
  createdBy: string,
  input: AnnouncementInput,
): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title: input.title,
      message: input.message,
      type: input.type,
      target: input.target,
      target_label: input.targetLabel,
      published_at: input.publishedAt || new Date().toISOString(),
      expires_at: input.expiresAt || null,
      is_active: true,
      created_by: createdBy,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create announcement: ${error?.message ?? "unknown error"}`);
  }

  await logAnnouncementActivity(
    supabase,
    "announcement_created",
    `Announcement "${input.title}" created`,
  );

  return mapAnnouncement(data as AnnouncementRow);
}

export async function updateAnnouncementImpl(
  supabase: SuperAdminClient,
  id: string,
  input: AnnouncementInput,
): Promise<Announcement> {
  const { data, error } = await supabase
    .from("announcements")
    .update({
      title: input.title,
      message: input.message,
      type: input.type,
      target: input.target,
      target_label: input.targetLabel,
      expires_at: input.expiresAt || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(ANNOUNCEMENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`Failed to update announcement: ${error?.message ?? "unknown error"}`);
  }

  await logAnnouncementActivity(
    supabase,
    "announcement_updated",
    `Announcement "${input.title}" updated`,
  );

  return mapAnnouncement(data as AnnouncementRow);
}

export async function setAnnouncementActiveImpl(
  supabase: SuperAdminClient,
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("announcements")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Failed to update announcement status: ${error.message}`);

  await logAnnouncementActivity(
    supabase,
    active ? "announcement_activated" : "announcement_archived",
    `Announcement ${active ? "activated" : "archived"}`,
  );
}

export async function deleteAnnouncementImpl(
  supabase: SuperAdminClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete announcement: ${error.message}`);

  await logAnnouncementActivity(supabase, "announcement_deleted", `Announcement ${id} deleted`);
}

export async function fetchActivityLogsImpl(supabase: SuperAdminClient): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, description, clinic_id, clinic_name, created_at, actor, type")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map(mapActivityLog);
}
