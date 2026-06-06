// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/receptionist-layout-shell (a "use client" component).
import { Suspense } from "react";
import { AgentWidgetMount } from "@/components/ai/AgentWidgetMount";
import ReceptionistLayoutShell from "@/components/layouts/receptionist-layout-shell";
import ReceptionistLoading from "./loading";

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
  return (
    <ReceptionistLayoutShell>
      <Suspense fallback={<ReceptionistLoading />}>{children}</Suspense>
      <Suspense fallback={null}>
        <AgentWidgetMount agentType="secretary" />
      </Suspense>
    </ReceptionistLayoutShell>
  );
}
