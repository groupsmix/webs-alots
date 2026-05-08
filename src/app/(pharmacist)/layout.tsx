// SC-01: Server component layout — client-interactive shell lives inside
// ClinicDashboardLayout (a "use client" component).
import { PharmacistLayoutShell } from "@/components/layouts/pharmacist-layout-shell";

export default function PharmacistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PharmacistLayoutShell>{children}</PharmacistLayoutShell>;
}
