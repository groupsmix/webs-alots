/**
 * Bug Condition Exploration Test for A7-05: Role Check Bypass
 * 
 * This file is intentionally written to bypass authentication by using
 * createClient() directly without withAuth() wrapper.
 * 
 * EXPECTED BEHAVIOR (after fix):
 * - ESLint should emit error: "no-direct-supabase-in-routes"
 * - This file should NOT be committable
 * 
 * CURRENT BEHAVIOR (unfixed code):
 * - ESLint allows this file (no rule exists yet)
 * - This demonstrates the authentication bypass vulnerability
 */

import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // BUG: Direct createClient() usage bypasses authentication
  // This route is accessible to unauthenticated users
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .limit(10);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ data });
}
