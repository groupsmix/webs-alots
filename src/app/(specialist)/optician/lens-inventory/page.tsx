import { Package } from "lucide-react";
import { LensInventoryManager } from "@/components/para-medical/lens-inventory-manager";
import { fetchLensInventory } from "@/lib/data/optician";
import { requireTenant } from "@/lib/tenant";

export default async function LensInventoryPage() {
  const tenant = await requireTenant();
  const items = await fetchLensInventory(tenant.clinicId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Lens Inventory</h1>
      </div>
      <LensInventoryManager items={items} />
    </div>
  );
}
