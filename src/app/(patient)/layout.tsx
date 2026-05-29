// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/patient-layout-shell (a "use client" component).
import { Suspense } from "react";
import PatientLayoutShell from "@/components/layouts/patient-layout-shell";
import PatientLoading from "./loading";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PatientLayoutShell>
      <Suspense fallback={<PatientLoading />}>{children}</Suspense>
    </PatientLayoutShell>
  );
}
