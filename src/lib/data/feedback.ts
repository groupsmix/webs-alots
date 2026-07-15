import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/types/database";

export interface FeedbackItem {
  id: string;
  clinic_id: string | null;
  role: string | null;
  rating: number | null;
  message: string;
  page_url: string | null;
  status: string;
  created_at: string | null;
}

export async function fetchFeedback(
  options: { status?: string; limit?: number } = {},
): Promise<FeedbackItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("app_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load feedback: ${error.message}`);
  }

  return (data ?? []) as Tables<"app_feedback">[];
}
