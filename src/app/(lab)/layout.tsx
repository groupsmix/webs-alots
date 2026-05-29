// SC-01: Server component layout — client-interactive shell lives inside
// ClinicDashboardLayout (a "use client" component).
import { Suspense } from "react";
import { LabLayoutShell } from "@/components/layouts/lab-layout-shell";
import LabLoading from "./loading";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <LabLayoutShell>
      <Suspense fallback={<LabLoading />}>{children}</Suspense>
    </LabLayoutShell>
  );
}
