"use client";

import { useState, useEffect } from "react";
import { MaterialsInventory } from "@/components/dental-lab/materials-inventory";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchLabMaterials, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorLabMaterialsPage() {
  const [materials, setMaterials] = useState<Parameters<typeof MaterialsInventory>[0]["materials"]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const data = await fetchLabMaterials(user.clinic_id);
      if (controller.signal.aborted) return;
      setMaterials(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load lab materials", {
          context: "doctor/lab-materials",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  if (loading) return <PageLoader message="Loading lab materials..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load lab materials.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Lab Materials" }]}
      />
      <h1 className="text-2xl font-bold">Lab Materials</h1>
      {/* Read-only view for doctors — inventory management is handled by clinic admin */}
      <MaterialsInventory materials={materials} />
    </div>
  );
}
