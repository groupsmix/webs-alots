/* eslint-disable i18next/no-literal-string -- Super-admin-only AI Builder
   surface: this whole tool is gated to internal super_admin users and is
   intentionally English-only. Adding it to the i18n keyset would inflate the
   FR/AR translation backlog for a tool no end user ever sees. */
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { BuilderChat } from "@/components/builder/builder-chat";
import { createClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "AI Builder — Super Admin",
  description: "Build internal tools and reports with AI",
};

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") redirect("/unauthorized");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">AI Builder</h1>
          <p className="text-sm text-muted-foreground">
            Build internal tools, reports, and scripts with Claude AI
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
          🔒 Super Admin only · Session: {profile.email}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <BuilderChat userId={user.id} />
      </div>
    </div>
  );
}
