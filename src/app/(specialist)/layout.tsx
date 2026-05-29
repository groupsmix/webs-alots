// SC-01: Server component layout — client-interactive shell extracted to
// a separate "use client" component (specialist-layout-shell).
import { Suspense } from "react";
import { SpecialistLayoutShell } from "@/components/layouts/specialist-layout-shell";
import SpecialistLoading from "./loading";

export default function SpecialistLayout({ children }: { children: React.ReactNode }) {
  return (
    <SpecialistLayoutShell>
      <Suspense fallback={<SpecialistLoading />}>{children}</Suspense>
    </SpecialistLayoutShell>
  );
}
