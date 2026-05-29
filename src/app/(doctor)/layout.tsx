// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/doctor-layout-shell (a "use client" component).
import { Suspense } from "react";
import DoctorLayoutShell from "@/components/layouts/doctor-layout-shell";
import DoctorLoading from "./loading";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DoctorLayoutShell>
      <Suspense fallback={<DoctorLoading />}>{children}</Suspense>
    </DoctorLayoutShell>
  );
}
