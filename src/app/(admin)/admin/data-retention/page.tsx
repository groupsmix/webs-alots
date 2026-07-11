import type { Metadata } from "next";
import { DataRetentionDashboard } from "@/components/admin/data-retention-dashboard";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Conservation des données",
};

export default async function DataRetentionPage() {
  await requireRole("clinic_admin", "super_admin");

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Conservation des données" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold">Conservation des données</h1>
        <p className="text-muted-foreground mt-1">
          Politique de conservation conforme à la Loi 09-08. Les dossiers médicaux sont conservés 5
          ans minimum.
        </p>
      </div>
      <DataRetentionDashboard />
    </div>
  );
}
