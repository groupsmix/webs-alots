// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/admin-layout-shell (a "use client" component).
import { Suspense } from "react";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
import AdminLayoutShell from "@/components/layouts/admin-layout-shell";
import { RouteScopeGate } from "@/components/route-scope-gate";
import AdminLoading from "./loading";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutShell>
      <Suspense fallback={<AdminLoading />}>
        <RouteScopeGate>{children}</RouteScopeGate>
      </Suspense>
      <Suspense fallback={null}>
        <AgentWidgetMount agentType="clinic_admin" />
      </Suspense>
    </AdminLayoutShell>
  );
}
