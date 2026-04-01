// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/super-admin-layout-shell (a "use client" component).
import SuperAdminLayoutShell from "@/components/layouts/super-admin-layout-shell";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuperAdminLayoutShell>{children}</SuperAdminLayoutShell>;
}
