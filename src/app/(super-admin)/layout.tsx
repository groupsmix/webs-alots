// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/super-admin-layout-shell (a "use client" component).
//
// AI assistant: the super-admin in-layout assistant is <AgentWidgetMount>
// (see below), NOT CopilotKit. The earlier in-app CopilotKit provider/sidebar
// (<CopilotShell>) was retired after PR #976: wrapping the layout in the
// provider made the whole super-admin tree depend on a live AI backend, so a
// 501 from /api/copilotkit tripped the error boundary on every page. The
// AgentWidget is self-contained and fails closed (the panel just stays empty
// if the backend is unavailable) instead of taking down the page.
//
// The CopilotKit *runtime* still exists, but as a standalone endpoint served by
// the separate webs-alots-ai Worker (workers/ai/) and called directly by
// clients — it is no longer mounted as a React provider here. The main app's
// /api/copilotkit route is an intentional 501 stub
// (Cloudflare zone routes send that path to webs-alots-ai first).
//
// To bring the CopilotKit endpoint online (ops, not code):
//   1. Set ANTHROPIC_API_KEY on webs-alots-ai (production + staging).
//   2. Recreate the Cloudflare zone routes (see workers/ai/wrangler.toml):
//        oltigo.com/api/copilotkit        -> webs-alots-ai
//        oltigo.com/api/copilotkit/*      -> webs-alots-ai
// Reviving the in-app CopilotKit sidebar would mean re-creating the removed
// <CopilotShell> component; prefer extending <AgentWidget> instead.
import { Suspense } from "react";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
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
