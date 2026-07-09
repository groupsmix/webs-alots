import { Suspense } from "react";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
import AdminLayoutShell from "@/components/layouts/admin-layout-shell";
import { RouteScopeGate } from "@/components/route-scope-gate";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutShell>
      <Suspense>
        <RouteScopeGate>{children}</RouteScopeGate>
      </Suspense>
      <Suspense fallback={null}>
        <AgentWidgetMount agentType="doctor" />
      </Suspense>
    </AdminLayoutShell>
  );
}
