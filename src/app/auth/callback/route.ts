import { NextResponse } from "next/server";
import { isSeedUserBlocked } from "@/lib/seed-guard";
import { createClient } from "@/lib/supabase-server";

/**
 * Validate that a redirect path is a safe, same-origin relative path.
 * Rejects protocol-relative URLs (//evil.com), absolute URLs, and
 * paths containing encoded characters that could bypass the check.
 */
const SAFE_PATH_REGEX = /^\/[a-zA-Z0-9\-_/]*$/;

function getSafeRedirectPath(raw: string | null): string {
  if (raw && SAFE_PATH_REGEX.test(raw)) {
    return raw;
  }
  return "/patient/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Fetch user profile to determine correct redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // SEED-01: Block seed users from completing auth callback in production
      if (user && isSeedUserBlocked(user.id)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=account_disabled`);
      }

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("auth_id", user.id)
          .single<{ role: string }>();

        if (profile) {
          const userProfile = profile as { role: string };
          const roleDashboardMap: Record<string, string> = {
            super_admin: "/super-admin/dashboard",
            clinic_admin: "/admin/dashboard",
            receptionist: "/receptionist/dashboard",
            doctor: "/doctor/dashboard",
            patient: "/patient/dashboard",
          };
          const redirectPath = roleDashboardMap[userProfile.role] || next;
          return NextResponse.redirect(`${origin}${redirectPath}`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
