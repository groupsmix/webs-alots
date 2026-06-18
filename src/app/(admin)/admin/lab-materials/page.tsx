"use client";

import { useEffect, useState } from "react";
import { MaterialsInventory } from "@/components/dental-lab/materials-inventory";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import { createClinicLabMaterial, restockClinicLabMaterial } from "@/lib/admin-actions";
import { fetchLabMaterials, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function AdminLabMaterialsPage() {
  const { addToast } = useToast();
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
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function reloadMaterials() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    setMaterials(await fetchLabMaterials(user.clinic_id));
  }

  async function handleAdd(material: {
    name: string;
    category: string;
    quantity: number;
    unit: string;
    minThreshold: number;
    unitCost: number;
    supplier: string;
  }) {
    try {
      await createClinicLabMaterial(material);
      await reloadMaterials();
      addToast("Material added", "success");
    } catch (err) {
      logger.warn("Failed to add lab material", { context: "admin/lab-materials", error: err });
      addToast("Failed to add material", "error");
    }
  }

  async function handleRestock(materialId: string, quantity: number) {
    if (quantity <= 0) {
      addToast("Enter a valid restock quantity", "error");
      return;
    }
    try {
      await restockClinicLabMaterial(materialId, quantity);
      await reloadMaterials();
      addToast("Inventory updated", "success");
    } catch (err) {
      logger.warn("Failed to restock lab material", {
        context: "admin/lab-materials",
        error: err,
      });
      addToast("Failed to restock material", "error");
    }
  }

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
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Lab Materials" }]}
      />
      <h1 className="text-2xl font-bold">Lab Materials Inventory</h1>
      <MaterialsInventory
        materials={materials}
        editable
        onAdd={handleAdd}
        onRestock={handleRestock}
      />
    </div>
  );
}
