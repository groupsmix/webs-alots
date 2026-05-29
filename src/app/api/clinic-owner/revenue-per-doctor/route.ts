/**
 * GET /api/clinic-owner/revenue-per-doctor
 *
 * Returns revenue metrics per doctor: total revenue, appointment count,
 * cancellation rate, and average revenue per appointment.
 * Requires clinic_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "12m":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

async function handler(request: NextRequest, auth: AuthContext) {
  try {
    const { supabase, profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) {
      return apiInternalError("Missing clinic context");
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "30d";
    const periodStart = getPeriodStart(period);

    const [doctorsRes, appointmentsRes, paymentsRes] = await Promise.all([
      supabase.from("users").select("id, name").eq("clinic_id", clinicId).eq("role", "doctor"),
      supabase
        .from("appointments")
        .select("id, doctor_id, status, slot_start, service_id")
        .eq("clinic_id", clinicId)
        .gte("slot_start", periodStart.toISOString()),
      supabase
        .from("payments")
        .select("id, amount, status, appointment_id, created_at")
        .eq("clinic_id", clinicId)
        .gte("created_at", periodStart.toISOString()),
    ]);

    const doctors = doctorsRes.data ?? [];
    const appointments = appointmentsRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    const completedPayments = payments.filter((p) => p.status === "completed");

    const doctorMetrics = doctors.map((doctor) => {
      const doctorAppts = appointments.filter((a) => a.doctor_id === doctor.id);
      const totalAppts = doctorAppts.length;
      const cancelledAppts = doctorAppts.filter((a) => a.status === "cancelled").length;
      const completedAppts = doctorAppts.filter((a) => a.status === "completed").length;
      const cancellationRate = totalAppts > 0 ? (cancelledAppts / totalAppts) * 100 : 0;

      const appointmentIds = new Set(doctorAppts.map((a) => a.id));
      const doctorPayments = completedPayments.filter(
        (p) => p.appointment_id && appointmentIds.has(p.appointment_id),
      );
      const totalRevenue = doctorPayments.reduce(
        (sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0),
        0,
      );
      const avgRevenuePerAppt = completedAppts > 0 ? totalRevenue / completedAppts : 0;

      return {
        doctorId: doctor.id,
        doctorName: doctor.name,
        totalRevenue,
        totalAppointments: totalAppts,
        completedAppointments: completedAppts,
        cancelledAppointments: cancelledAppts,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        avgRevenuePerAppointment: Math.round(avgRevenuePerAppt),
      };
    });

    doctorMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalClinicRevenue = doctorMetrics.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalClinicAppointments = doctorMetrics.reduce((sum, d) => sum + d.totalAppointments, 0);
    const avgClinicCancellationRate =
      totalClinicAppointments > 0
        ? (doctorMetrics.reduce((sum, d) => sum + d.cancelledAppointments, 0) /
            totalClinicAppointments) *
          100
        : 0;

    return apiSuccess({
      period,
      doctors: doctorMetrics,
      summary: {
        totalRevenue: totalClinicRevenue,
        totalAppointments: totalClinicAppointments,
        avgCancellationRate: Math.round(avgClinicCancellationRate * 100) / 100,
        doctorCount: doctors.length,
      },
    });
  } catch (err) {
    logger.error("Failed to fetch revenue per doctor", {
      context: "clinic-owner/revenue-per-doctor",
      error: err,
    });
    return apiInternalError("Failed to fetch revenue metrics");
  }
}

export const GET = withAuth(handler, ALLOWED_ROLES);
