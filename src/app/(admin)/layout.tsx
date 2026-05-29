// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/admin-layout-shell (a "use client" component).
import { Suspense } from "react";
import AdminLayoutShell from "@/components/layouts/admin-layout-shell";
import AdminLoading from "./loading";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutShell>
      <Suspense fallback={<AdminLoading />}>{children}</Suspense>
    </AdminLayoutShell>
  );
}
