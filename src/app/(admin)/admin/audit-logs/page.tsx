import type { Metadata } from "next";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Journal d'audit",
};

export default async function AuditLogsPage() {
  await requireRole("clinic_admin", "super_admin");

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Journal d'audit" }]}
      />
      <div>
        <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
        <p className="text-muted-foreground mt-1">
          Historique complet des actions effectuées dans votre cabinet.
        </p>
      </div>
      <AuditLogViewer />
    </div>
  );
}
