"use client";

import { useState } from "react";
import { MaterialsInventory } from "@/components/dental-lab/materials-inventory";

export default function AdminLabMaterialsPage() {
  const [materials] = useState<Parameters<typeof MaterialsInventory>[0]["materials"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lab Materials Inventory</h1>
      <MaterialsInventory materials={materials} editable />
    </div>
  );
}
