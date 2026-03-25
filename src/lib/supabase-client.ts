import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

// Access NEXT_PUBLIC_* env vars via static property access so that Next.js
// can inline them at build time.  Dynamic access (process.env[name]) is NOT
// guaranteed to work in the browser bundle.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set at build time.",
    );
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
