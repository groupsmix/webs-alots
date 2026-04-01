// SC-01: Server component layout — client-interactive shell lives inside
// ClinicDashboardLayout (a "use client" component).
import { LabLayoutShell } from "@/components/layouts/lab-layout-shell";

export default function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LabLayoutShell>{children}</LabLayoutShell>;
}
