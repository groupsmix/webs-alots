// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/receptionist-layout-shell (a "use client" component).
import ReceptionistLayoutShell from "@/components/layouts/receptionist-layout-shell";

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ReceptionistLayoutShell>{children}</ReceptionistLayoutShell>;
}
