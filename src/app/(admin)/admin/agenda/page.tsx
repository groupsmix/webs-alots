import { AdminAgendaView, type AdminAgendaAppointment } from "@/components/admin/admin-agenda-view";
import { createClient } from "@/lib/supabase-server";
import { requireTenantWithConfig } from "@/lib/tenant";
import { clinicDateTime } from "@/lib/timezone";
import { getLocalDateStr } from "@/lib/utils";

interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  service_id: string | null;
  slot_start: string;
  status: string;
}

export default async function AdminAgendaPage() {
  const { tenant, config } = await requireTenantWithConfig();
  const supabase = await createClient();
  const today = getLocalDateStr(new Date(), config.timezone);
  const endDate = new Date(clinicDateTime(today, "12:00", config.timezone));
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const endDateStr = getLocalDateStr(endDate, config.timezone);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, service_id, slot_start, status")
    .eq("clinic_id", tenant.clinicId)
    .gte("slot_start", clinicDateTime(today, "00:00", config.timezone).toISOString())
    .lt("slot_start", clinicDateTime(endDateStr, "00:00", config.timezone).toISOString())
    .order("slot_start", { ascending: true })
    .limit(200);

  if (error) throw error;

  const appointmentRows = (data ?? []) as AppointmentRow[];
  const userIds = [
    ...new Set(
      appointmentRows.flatMap((appointment) => [appointment.patient_id, appointment.doctor_id]),
    ),
  ];
  const serviceIds = [
    ...new Set(
      appointmentRows
        .map((appointment) => appointment.service_id)
        .filter((serviceId): serviceId is string => Boolean(serviceId)),
    ),
  ];

  const [usersResult, servicesResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id, name").eq("clinic_id", tenant.clinicId).in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length > 0
      ? supabase
          .from("services")
          .select("id, name")
          .eq("clinic_id", tenant.clinicId)
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (servicesResult.error) throw servicesResult.error;

  const userNames = new Map(
    ((usersResult.data ?? []) as { id: string; name: string }[]).map((user) => [
      user.id,
      user.name,
    ]),
  );
  const serviceNames = new Map(
    ((servicesResult.data ?? []) as { id: string; name: string }[]).map((service) => [
      service.id,
      service.name,
    ]),
  );

  const appointments: AdminAgendaAppointment[] = appointmentRows.map((appointment) => ({
    id: appointment.id,
    slotStart: appointment.slot_start,
    status: appointment.status,
    patientName: userNames.get(appointment.patient_id) ?? "—",
    doctorName: userNames.get(appointment.doctor_id) ?? "—",
    serviceName: appointment.service_id ? (serviceNames.get(appointment.service_id) ?? "—") : "—",
  }));

  return <AdminAgendaView appointments={appointments} today={today} timezone={config.timezone} />;
}
