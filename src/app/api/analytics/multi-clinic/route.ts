/**
 * GET /api/analytics/multi-clinic — Cross-clinic analytics for super_admin
 *
 * Returns aggregated metrics across all clinics:
 * - Revenue per clinic
 * - Most active clinics (appointments, patients)
 * - Churn risk signals (inactive clinics, declining appointments)
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

async function handler(_request: NextRequest, auth: AuthContext) {
  try {
    const { supabase } = auth;

    const [clinicsRes, paymentsRes, appointmentsRes, patientsRes] = await Promise.all([
      // MA-04: exclude soft-deleted clinics
      // nosemgrep: semgrep.tenant-scoping
      supabase
        .from("clinics")
        .select("id, name, type, tier, status, subdomain, created_at")
        .is("deleted_at", null),
      supabase.from("payments").select("clinic_id, amount, status, created_at"), // nosemgrep: semgrep.tenant-scoping
      supabase.from("appointments").select("clinic_id, status, created_at"), // nosemgrep: semgrep.tenant-scoping
      // nosemgrep: semgrep.tenant-scoping
      supabase.from("users").select("clinic_id, created_at").eq("role", "patient"),
    ]);

    const clinics = clinicsRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const appointments = appointmentsRes.data ?? [];
    const patients = patientsRes.data ?? [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const clinicAnalytics = clinics.map((clinic) => {
      const clinicPayments = payments.filter(
        (p) => p.clinic_id === clinic.id && p.status === "completed",
      );
      const clinicAppointments = appointments.filter((a) => a.clinic_id === clinic.id);
      const clinicPatients = patients.filter((p) => p.clinic_id === clinic.id);

      const totalRevenue = clinicPayments.reduce(
        (sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0),
        0,
      );
      const recentRevenue = clinicPayments
        .filter((p) => p.created_at && new Date(p.created_at) >= thirtyDaysAgo)
        .reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0);

      const recentAppointments = clinicAppointments.filter(
        (a) => a.created_at && new Date(a.created_at) >= thirtyDaysAgo,
      ).length;
      const previousPeriodAppointments = clinicAppointments.filter(
        (a) =>
          a.created_at &&
          new Date(a.created_at) >= sixtyDaysAgo &&
          new Date(a.created_at) < thirtyDaysAgo,
      ).length;

      const appointmentTrend =
        previousPeriodAppointments > 0
          ? ((recentAppointments - previousPeriodAppointments) / previousPeriodAppointments) * 100
          : recentAppointments > 0
            ? 100
            : 0;

      const churnRisk = computeChurnRisk(
        recentAppointments,
        previousPeriodAppointments,
        recentRevenue,
        clinic.status ?? "active",
      );

      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicType: clinic.type,
        tier: clinic.tier,
        status: clinic.status,
        subdomain: clinic.subdomain,
        totalRevenue,
        recentRevenue,
        totalAppointments: clinicAppointments.length,
        recentAppointments,
        appointmentTrend: Math.round(appointmentTrend * 10) / 10,
        totalPatients: clinicPatients.length,
        churnRisk,
      };
    });

    const summary = {
      totalClinics: clinics.length,
      activeClinics: clinics.filter((c) => c.status === "active").length,
      totalRevenue: clinicAnalytics.reduce((sum, c) => sum + c.totalRevenue, 0),
      totalRecentRevenue: clinicAnalytics.reduce((sum, c) => sum + c.recentRevenue, 0),
      highChurnRisk: clinicAnalytics.filter((c) => c.churnRisk === "high").length,
      mediumChurnRisk: clinicAnalytics.filter((c) => c.churnRisk === "medium").length,
    };

    return apiSuccess({ summary, clinics: clinicAnalytics });
  } catch (error) {
    logger.error("Multi-clinic analytics failed", { error });
    return apiInternalError();
  }
}

function computeChurnRisk(
  recentAppointments: number,
  previousAppointments: number,
  recentRevenue: number,
  status: string,
): "low" | "medium" | "high" {
  if (status === "suspended") return "high";
  if (recentAppointments === 0 && previousAppointments === 0) return "high";
  if (recentAppointments === 0 && previousAppointments > 0) return "high";
  if (previousAppointments > 0 && recentAppointments < previousAppointments * 0.5) return "medium";
  if (recentRevenue === 0) return "medium";
  return "low";
}

export const GET = withAuth(handler, ALLOWED_ROLES, { failOpen: true });
