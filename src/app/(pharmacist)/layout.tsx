// SC-01: Server component layout — client-interactive shell lives inside
// ClinicDashboardLayout (a "use client" component).
import { Suspense } from "react";
import { PharmacistLayoutShell } from "@/components/layouts/pharmacist-layout-shell";
import PharmacistLoading from "./loading";

export default function PharmacistLayout({ children }: { children: React.ReactNode }) {
  return (
    <PharmacistLayoutShell>
      <Suspense fallback={<PharmacistLoading />}>{children}</Suspense>
    </PharmacistLayoutShell>
  );
}
