import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/patient/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Fetch user profile to determine correct redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("auth_id", user.id)
          .single<{ role: string }>();

        if (profile) {
          const roleDashboardMap: Record<string, string> = {
            super_admin: "/super-admin/dashboard",
            clinic_admin: "/admin/dashboard",
            receptionist: "/receptionist/dashboard",
            doctor: "/doctor/dashboard",
            patient: "/patient/dashboard",
          };
          const redirectPath = roleDashboardMap[profile.role] || next;
          return NextResponse.redirect(`${origin}${redirectPath}`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
