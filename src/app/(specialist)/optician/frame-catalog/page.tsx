import { Glasses } from "lucide-react";
import { FrameCatalog } from "@/components/para-medical/frame-catalog";
import { fetchFrameCatalog } from "@/lib/data/optician";
import { requireTenant } from "@/lib/tenant";

export default async function FrameCatalogPage() {
  const tenant = await requireTenant();
  const frames = await fetchFrameCatalog(tenant.clinicId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Glasses className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Frame Catalog</h1>
      </div>
      <FrameCatalog frames={frames} />
    </div>
  );
}
