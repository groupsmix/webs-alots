import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant } from "@/lib/tenant";

/**
 * GET /api/checkin/lookup?phone=...
 *
 * Look up today's appointments for a patient by phone number.
 *
 * S-02: clinicId is derived from the subdomain via getTenant() — it is
 * never read from the URL/body. If a caller still supplies a `clinicId`
 * query param (legacy clients, manual probing) it must agree with the
 * subdomain-resolved tenant or the request is rejected. This prevents
 * unauthenticated cross-tenant enumeration.
 */
export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  const suppliedClinicId = request.nextUrl.searchParams.get("clinicId");

  if (!phone) {
    return apiError("Missing phone", 400);
  }

  const tenant = await getTenant();
  if (!tenant?.clinicId) {
    return apiError("Tenant context is required", 400, "TENANT_REQUIRED");
  }
  const clinicId = tenant.clinicId;

  if (suppliedClinicId && suppliedClinicId !== clinicId) {
    logger.warn("Rejected check-in lookup with mismatched clinicId", {
      context: "api/checkin/lookup",
      tenantClinicId: clinicId,
      suppliedClinicId,
    });
    return apiError("clinicId mismatch", 403, "TENANT_MISMATCH");
  }

  try {
    const supabase = await createTenantClient(clinicId);

    // Find the patient by phone number
    const { data: patient } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("clinic_id", clinicId)
      .eq("role", "patient")
      .eq("phone", phone)
      .limit(1)
      .single();

    if (!patient) {
      // Try with normalized phone (remove spaces, dashes)
      const normalizedPhone = phone.replace(/[\s\-()]/g, "");
      const { data: patientAlt } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("clinic_id", clinicId)
        .eq("role", "patient")
        .eq("phone", normalizedPhone)
        .limit(1)
        .single();

      if (!patientAlt) {
        return apiSuccess({ appointments: [] });
      }

      return await findTodayAppointments(supabase, patientAlt.id, clinicId);
    }

    return await findTodayAppointments(supabase, patient.id, clinicId);
  } catch (err) {
    logger.error("Failed to look up appointments", { context: "api/checkin/lookup", error: err });
    return apiInternalError("Failed to look up appointments");
  }
}

async function findTodayAppointments(
  supabase: Awaited<ReturnType<typeof createTenantClient>>,
  patientId: string,
  clinicId: string,
) {
  const today = new Date().toISOString().split("T")[0];

  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id,
      appointment_date,
      start_time,
      status,
      doctors:doctor_id (name),
      services:service_id (name)
    `)
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("appointment_date", today)
    .in("status", ["confirmed", "pending", "scheduled"])
    .order("start_time", { ascending: true });

  const mapped = (appointments ?? []).map((appt) => {
    const doctorRaw = appt.doctors;
    const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;
    const serviceRaw = appt.services;
    const service = Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw;

    return {
      id: appt.id,
      doctorName: doctor?.name ?? "Doctor",
      serviceName: service?.name ?? "Appointment",
      date: appt.appointment_date,
      time: appt.start_time ?? "",
      status: appt.status,
    };
  });

  return apiSuccess({ appointments: mapped });
}
