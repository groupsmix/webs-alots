"use client";

import { useState, useEffect, useCallback } from "react";
import { Package } from "lucide-react";
import { LensInventoryManager } from "@/components/para-medical/lens-inventory-manager";
import { getCurrentUser } from "@/lib/data/client";
import type { LensInventoryItem } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function LensInventoryPage() {
  const [items, setItems] = useState<LensInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setItems([]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading lens inventory..." />;
  }

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
