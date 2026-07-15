import type { OwnerTodaySummary } from "@/lib/data/admin-owner-dashboard";
import type { DashboardStats } from "@/lib/data/dashboard";

export type OwnerAttentionKind =
  | "unconfirmedToday"
  | "waitingToday"
  | "noShowToday"
  | "missingDoctor"
  | "missingPatient"
  | "noShowRate"
  | "lowRating";

export interface OwnerAttentionItem {
  kind: OwnerAttentionKind;
  href: string;
  tone: "warning" | "danger";
}

export function calculateNoShowRate(stats: DashboardStats): number {
  if (stats.totalAppointments === 0) return 0;
  return Math.round((stats.noShowCount / stats.totalAppointments) * 100);
}

export function getOwnerAttentionItems(
  stats: DashboardStats,
  today?: OwnerTodaySummary,
): OwnerAttentionItem[] {
  const items: OwnerAttentionItem[] = [];
  const noShowRate = calculateNoShowRate(stats);

  if (today && today.unconfirmedAppointments > 0) {
    items.push({
      kind: "unconfirmedToday",
      href: "/admin/agenda",
      tone: "warning",
    });
  }

  if (today && today.checkedInAppointments > 0) {
    items.push({
      kind: "waitingToday",
      href: "/admin/agenda",
      tone: "warning",
    });
  }

  if (today && today.noShowAppointments > 0) {
    items.push({
      kind: "noShowToday",
      href: "/admin/agenda",
      tone: "warning",
    });
  }

  if (stats.doctorCount === 0) {
    items.push({
      kind: "missingDoctor",
      href: "/admin/doctors",
      tone: "warning",
    });
  }

  if (stats.totalPatients === 0) {
    items.push({
      kind: "missingPatient",
      href: "/admin/patients",
      tone: "warning",
    });
  }

  if (noShowRate >= 10 && !today?.noShowAppointments) {
    items.push({
      kind: "noShowRate",
      href: "/admin/analytics",
      tone: noShowRate >= 20 ? "danger" : "warning",
    });
  }

  if (stats.averageRating > 0 && stats.averageRating < 4) {
    items.push({
      kind: "lowRating",
      href: "/admin/reviews",
      tone: "warning",
    });
  }

  return items;
}
