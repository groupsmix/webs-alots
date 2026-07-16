"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTenantClient } from "@/lib/supabase-server";

export interface CustomDomain {
  id: string;
  domain: string;
  status: "pending" | "active" | "failed" | "removing";
  ssl_status: string | null;
  verification_txt: string | null;
  created_at: string;
}

interface CustomDomainRow {
  id: string;
  clinic_id: string;
  domain: string;
  status: string;
  ssl_status: string | null;
  verification_txt: string | null;
  created_at: string;
}

export async function fetchCustomDomains(clinicId: string): Promise<CustomDomain[]> {
  const supabase = await createTenantClient(clinicId);
  const untyped = supabase as unknown as SupabaseClient;

  const { data, error } = await untyped
    .from("custom_domains")
    .select("id, clinic_id, domain, status, ssl_status, verification_txt, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load custom domains: ${error.message}`);

  return ((data ?? []) as unknown as CustomDomainRow[]).map((row) => ({
    id: row.id,
    domain: row.domain,
    status: row.status as CustomDomain["status"],
    ssl_status: row.ssl_status,
    verification_txt: row.verification_txt,
    created_at: row.created_at,
  }));
}
