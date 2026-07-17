import { Suspense } from "react";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
import DoctorLayoutShell from "@/components/layouts/doctor-layout-shell";
import { RouteScopeGate } from "@/components/route-scope-gate";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DoctorLayoutShell>
      <Suspense>
        <RouteScopeGate>{children}</RouteScopeGate>
      </Suspense>
      <Suspense fallback={null}>
        <AgentWidgetMount agentType="doctor" />
      </Suspense>
    </DoctorLayoutShell>
  );
}
