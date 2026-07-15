import type { InvoiceView } from "@/lib/data/client/invoices";
import { fetchUserNameMap } from "@/lib/data/users";
import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";

export async function fetchInvoices(
  clinicId: string,
  options?: { sinceDate?: string },
): Promise<InvoiceView[]> {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (options?.sinceDate) {
    query = query.gte("created_at", options.sinceDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load invoices: ${error.message}`);
  }

  const rows = (data ?? []) as Tables<"payments">[];
  const nameMap = await fetchUserNameMap(
    supabase,
    clinicId,
    rows.map((r) => r.patient_id),
  );

  return rows.map((r) => ({
    id: r.id,
    patientName: nameMap.get(r.patient_id) ?? "Patient",
    appointmentId: r.appointment_id ?? undefined,
    amount: r.amount,
    currency: "MAD",
    method: r.method ?? "cash",
    status: r.status === "completed" ? "paid" : (r.status ?? "pending"),
    date: r.created_at ? getLocalDateStr(new Date(r.created_at)) : "",
  }));
}
