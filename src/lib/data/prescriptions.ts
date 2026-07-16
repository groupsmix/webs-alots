import type { PrescriptionView } from "@/lib/data/client/prescriptions";
import { fetchUserNameMap } from "@/lib/data/users";
import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";

export async function fetchPatientPrescriptions(
  clinicId: string,
  patientId: string,
): Promise<PrescriptionView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load prescriptions: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"prescriptions">[];
  const userIds = new Set<string>([
    ...rows.map((r) => r.patient_id),
    ...rows.map((r) => r.doctor_id),
  ]);
  const nameMap = await fetchUserNameMap(supabase, clinicId, Array.from(userIds));

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: nameMap.get(r.patient_id) ?? "Patient",
    doctorName: nameMap.get(r.doctor_id) ?? "Doctor",
    date: r.created_at ? r.created_at.split("T")[0] : "",
    medications: (r.items as { name: string; dosage: string; duration: string }[] | null) ?? [],
    notes: r.notes ?? undefined,
  }));
}
