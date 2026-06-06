// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/super-admin-layout-shell (a "use client" component).
//
// HOTFIX 2026-06-06: CopilotShell temporarily disabled.
// The CopilotKit runtime endpoint (/api/copilotkit) was moved to the
// separate webs-alots-ai Worker in PR #976. That Worker requires an
// ANTHROPIC_API_KEY secret which is not yet provisioned. With the
// AI Worker routes removed from the zone, the main app's /api/copilotkit
// route returns a 501 stub on every request, causing CopilotKit's
// provider initialization to throw and the super-admin error boundary
// to fire on every super-admin page (including /super-admin/dashboard).
//
// To restore the sidebar:
//   1. Set ANTHROPIC_API_KEY on webs-alots-ai (production + staging).
//   2. Recreate Cloudflare zone routes:
//        oltigo.com/api/copilotkit       -> webs-alots-ai
//        oltigo.com/api/copilotkit/*     -> webs-alots-ai
//        oltigo.com/api/builder/sandbox  -> webs-alots-ai
//        oltigo.com/api/builder/sandbox/* -> webs-alots-ai
//   3. Re-enable the <CopilotShell> wrapper below.
import { Suspense } from "react";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import SuperAdminLayoutShell from "@/components/layouts/super-admin-layout-shell";
import SuperAdminLoading from "./loading";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <SuperAdminLayoutShell>
        <Suspense fallback={<SuperAdminLoading />}>{children}</Suspense>
        <Suspense fallback={null}>
          <AgentWidgetMount agentType="super_admin" />
        </Suspense>
      </SuperAdminLayoutShell>
    </>
  );
}
