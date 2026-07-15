import type { ReviewView } from "@/lib/data/client/reviews";
import { fetchUserNameMap } from "@/lib/data/users";
import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";

export async function fetchReviews(clinicId: string): Promise<ReviewView[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load reviews: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"reviews">[];

  const userIds = new Set<string>([
    ...rows.map((r) => r.patient_id),
    ...rows.filter((r) => r.doctor_id).map((r) => r.doctor_id as string),
  ]);

  const nameMap = await fetchUserNameMap(supabase, clinicId, Array.from(userIds));

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: nameMap.get(r.patient_id) ?? "Patient",
    doctorName: r.doctor_id ? (nameMap.get(r.doctor_id) ?? "Doctor") : "General",
    rating: r.stars,
    comment: r.comment ?? "",
    date: r.created_at?.split("T")[0] ?? "",
    status: r.is_visible ? "published" : "pending",
    replied: !!r.response,
    response: r.response ?? undefined,
  }));
}
