// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/super-admin-layout-shell (a "use client" component).
import { Suspense } from "react";
import { CopilotShell } from "@/components/admin/copilot-shell";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import SuperAdminLayoutShell from "@/components/layouts/super-admin-layout-shell";
import SuperAdminLoading from "./loading";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      <SuperAdminLayoutShell>
        <CopilotShell>
          <Suspense fallback={<SuperAdminLoading />}>{children}</Suspense>
        </CopilotShell>
      </SuperAdminLayoutShell>
    </>
  );
}
