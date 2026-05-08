// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/patient-layout-shell (a "use client" component).
import PatientLayoutShell from "@/components/layouts/patient-layout-shell";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PatientLayoutShell>{children}</PatientLayoutShell>;
}
