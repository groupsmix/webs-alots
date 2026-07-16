"use server";

import { createTenantClient } from "@/lib/supabase-server";

export interface DoctorMetric {
  doctorId: string;
  doctorName: string;
  totalRevenue: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  cancellationRate: number;
  avgRevenuePerAppointment: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalAppointments: number;
  avgCancellationRate: number;
  doctorCount: number;
}

export interface RevenuePerDoctorView {
  period: string;
  doctors: DoctorMetric[];
  summary: RevenueSummary;
}

interface DoctorRow {
  id: string;
  name: string;
}

interface AppointmentRow {
  id: string;
  doctor_id: string;
  status: string;
  slot_start: string;
  service_id: string | null;
}

interface PaymentRow {
  id: string;
  amount: number | null;
  status: string;
  appointment_id: string | null;
  created_at: string;
}

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

export async function fetchRevenuePerDoctor(
  clinicId: string,
  period = "30d",
): Promise<RevenuePerDoctorView> {
  const supabase = await createTenantClient(clinicId);
  const periodStart = getPeriodStart(period);

  const [
    { data: doctors, error: doctorsError },
    { data: appointments, error: appointmentsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
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

  if (doctorsError) throw new Error(`Failed to load doctors: ${doctorsError.message}`);
  if (appointmentsError)
    throw new Error(`Failed to load appointments: ${appointmentsError.message}`);
  if (paymentsError) throw new Error(`Failed to load payments: ${paymentsError.message}`);

  const doctorRows = ((doctors ?? []) as unknown as DoctorRow[]).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  const appointmentRows = (appointments ?? []) as unknown as AppointmentRow[];
  const paymentRows = (payments ?? []) as unknown as PaymentRow[];
  const completedPayments = paymentRows.filter((p) => p.status === "completed");

  const doctorMetrics = doctorRows.map((doctor) => {
    const doctorAppts = appointmentRows.filter((a) => a.doctor_id === doctor.id);
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

  return {
    period,
    doctors: doctorMetrics,
    summary: {
      totalRevenue: totalClinicRevenue,
      totalAppointments: totalClinicAppointments,
      avgCancellationRate: Math.round(avgClinicCancellationRate * 100) / 100,
      doctorCount: doctorRows.length,
    },
  };
}
