import { Suspense } from "react";
import AdminLayoutShell from "@/components/layouts/admin-layout-shell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayoutShell>
      <Suspense>{children}</Suspense>
    </AdminLayoutShell>
  );
}
