import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";

/**
 * Admin Analytics Dashboard
 *
 * Server Component that fetches appointments, payments, services, doctors,
 * waiting list, and patient counts from Supabase, then passes the data to
 * the client-side AnalyticsDashboard for interactive visualisation.
 */

export default async function AnalyticsPage() {
  const tenant = await requireTenant();
  const supabase = await createClient();
  const clinicId = tenant.clinicId;

  // Fetch all data in parallel — read-only queries on existing tables.
  const [
    appointmentsRes,
    paymentsRes,
    servicesRes,
    doctorsRes,
    waitingListRes,
    patientsRes,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, slot_start, doctor_id, patient_id, service_id, is_first_visit, created_at")
      .eq("clinic_id", clinicId)
      .order("slot_start", { ascending: false })
      .limit(2000),
    supabase
      .from("payments")
      .select("id, amount, method, status, created_at, appointment_id")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("services")
      .select("id, name, price")
      .eq("clinic_id", clinicId),
    supabase
      .from("users")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("role", "doctor"),
    supabase
      .from("waiting_list")
      .select("id, status")
      .eq("clinic_id", clinicId),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("role", "patient"),
  ]);

  const appointments = (appointmentsRes.data ?? []) as {
    id: string;
    status: string;
    slot_start: string;
    doctor_id: string;
    patient_id: string;
    service_id: string | null;
    is_first_visit: boolean;
    created_at: string;
  }[];

  const payments = (paymentsRes.data ?? []) as {
    id: string;
    amount: number;
    method: string | null;
    status: string;
    created_at: string;
    appointment_id: string | null;
  }[];

  const services = (servicesRes.data ?? []) as {
    id: string;
    name: string;
    price: number | null;
  }[];

  const doctors = (doctorsRes.data ?? []) as {
    id: string;
    name: string;
  }[];

  const waitingList = (waitingListRes.data ?? []) as {
    id: string;
    status: string;
  }[];

  const totalPatients = patientsRes.count ?? 0;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Analytics" }]} />
      <h1 className="text-2xl font-bold">Tableau de bord analytique</h1>

      <AnalyticsDashboard
        appointments={appointments}
        payments={payments}
        services={services}
        doctors={doctors}
        waitingList={waitingList}
        totalPatients={totalPatients}
      />
    </div>
  );
}
