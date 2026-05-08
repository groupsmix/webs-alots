// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/admin-layout-shell (a "use client" component).
import AdminLayoutShell from "@/components/layouts/admin-layout-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
