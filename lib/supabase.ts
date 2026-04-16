import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// createClient throws if the URL is empty, so use a placeholder during build
// or when env vars are not yet available. Queries will simply return empty data.
const hasConfig = supabaseUrl && supabaseAnonKey;

/** Browser-safe Supabase client (uses anon key, subject to RLS) */
export const supabase: SupabaseClient<Database> = hasConfig
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createClient<Database>("https://placeholder.supabase.co", "placeholder-key");
