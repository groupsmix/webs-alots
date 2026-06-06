import { Suspense } from "react";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
import AdminLayoutShell from "@/components/layouts/admin-layout-shell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutShell>
      <Suspense>{children}</Suspense>
      <Suspense fallback={null}>
        <AgentWidgetMount agentType="doctor" />
      </Suspense>
    </AdminLayoutShell>
  );
}
