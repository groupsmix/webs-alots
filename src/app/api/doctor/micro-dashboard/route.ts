import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/utils";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

/**
 * GET /api/doctor/micro-dashboard
 *
 * Returns a compact snapshot for the between-patients micro-dashboard:
 * - Next patient (name, appointment time, history highlights)
 * - Pending tasks count
 * - One urgent alert (if any)
 * - Remaining appointments today
 *
 * Designed to be consumed in <30 seconds between consultations.
 */
async function handler(_request: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  const doctorId = auth.profile.id;

  if (!clinicId) {
    return apiError("Clinic context required — use a clinic subdomain", 400);
  }

  try {
    const untypedSupabase = auth.supabase as unknown as SupabaseUntyped;
    const today = getLocalDateStr();
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Fetch today's upcoming appointments for this doctor
    const { data: upcomingApptsRaw, error: apptsError } = await untypedSupabase
      .from("appointments")
      .select(
        "id, patient_id, service_id, appointment_date, start_time, status, is_first_visit, is_emergency, notes",
      )
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("appointment_date", today)
      .in("status", ["confirmed", "checked_in", "checked-in", "scheduled"])
      .gte("start_time", currentTime)
      .order("start_time", { ascending: true })
      .limit(10);

    if (apptsError) {
      logger.error("Failed to fetch micro-dashboard appointments", {
        context: "api/doctor/micro-dashboard",
        error: apptsError,
      });
      return apiInternalError("Failed to load micro-dashboard data");
    }

    type ApptRow = {
      id: string;
      patient_id: string;
      service_id: string | null;
      appointment_date: string;
      start_time: string;
      status: string;
      is_first_visit: boolean;
      is_emergency: boolean;
      notes: string | null;
    };
    const upcomingAppts = (upcomingApptsRaw ?? []) as ApptRow[];

    // Get patient details for next patient
    let nextPatient: {
      id: string;
      name: string;
      phone: string | null;
      appointmentTime: string;
      isFirstVisit: boolean;
      isEmergency: boolean;
      notes: string | null;
      pastVisitCount: number;
      lastVisitDate: string | null;
    } | null = null;

    if (upcomingAppts.length > 0) {
      const next = upcomingAppts[0];

      // Get patient name
      const { data: patientData } = await untypedSupabase
        .from("users")
        .select("id, name, phone")
        .eq("clinic_id", clinicId)
        .eq("id", next.patient_id)
        .single();

      type PatientRow = { id: string; name: string; phone: string | null };
      const patient = patientData as PatientRow | null;

      // Get past visit count for this patient with this doctor
      const { count: pastVisits } = await untypedSupabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("patient_id", next.patient_id)
        .eq("doctor_id", doctorId)
        .in("status", ["completed", "done"])
        .lt("appointment_date", today);

      // Get last visit date
      const { data: lastVisitData } = await untypedSupabase
        .from("appointments")
        .select("appointment_date")
        .eq("clinic_id", clinicId)
        .eq("patient_id", next.patient_id)
        .eq("doctor_id", doctorId)
        .in("status", ["completed", "done"])
        .order("appointment_date", { ascending: false })
        .limit(1);

      type LastVisitRow = { appointment_date: string };
      const lastVisitRows = (lastVisitData ?? []) as LastVisitRow[];

      nextPatient = {
        id: next.patient_id,
        name: patient?.name ?? "Patient inconnu",
        phone: patient?.phone ?? null,
        appointmentTime: next.start_time,
        isFirstVisit: next.is_first_visit,
        isEmergency: next.is_emergency,
        notes: next.notes,
        pastVisitCount: pastVisits ?? 0,
        lastVisitDate: lastVisitRows[0]?.appointment_date ?? null,
      };
    }

    // Check for urgent alerts: emergency patients in waiting room
    const { data: emergencyPatientsRaw } = await untypedSupabase
      .from("appointments")
      .select("id, patient_id, start_time")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("appointment_date", today)
      .eq("is_emergency", true)
      .in("status", ["confirmed", "checked_in", "checked-in", "scheduled"])
      .order("start_time", { ascending: true })
      .limit(1);

    type EmergencyRow = { id: string; patient_id: string; start_time: string };
    const emergencyPatients = (emergencyPatientsRaw ?? []) as EmergencyRow[];

    let urgentAlert: { type: string; message: string } | null = null;
    if (emergencyPatients.length > 0) {
      const { data: emergencyPatientData } = await untypedSupabase
        .from("users")
        .select("name")
        .eq("clinic_id", clinicId)
        .eq("id", emergencyPatients[0].patient_id)
        .single();

      type NameRow = { name: string };
      const emergencyPatient = emergencyPatientData as NameRow | null;

      urgentAlert = {
        type: "emergency",
        message: `Urgence: ${emergencyPatient?.name ?? "Patient"} — ${emergencyPatients[0].start_time}`,
      };
    }

    // Count completed today for progress tracking
    const { count: completedToday } = await untypedSupabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .eq("appointment_date", today)
      .in("status", ["completed", "done"]);

    return apiSuccess({
      nextPatient,
      remainingCount: upcomingAppts.length,
      completedToday: completedToday ?? 0,
      urgentAlert,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Micro-dashboard error", {
      context: "api/doctor/micro-dashboard",
      error: err,
    });
    return apiInternalError("Failed to load micro-dashboard");
  }
}

export const GET = withAuth(handler, ["doctor", "clinic_admin"]);
