// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/doctor-layout-shell (a "use client" component).
import DoctorLayoutShell from "@/components/layouts/doctor-layout-shell";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DoctorLayoutShell>{children}</DoctorLayoutShell>;
}
