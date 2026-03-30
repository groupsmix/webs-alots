"use client";

import { useState } from "react";
import { MaterialsInventory } from "@/components/dental-lab/materials-inventory";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorLabMaterialsPage() {
  const [materials] = useState<Parameters<typeof MaterialsInventory>[0]["materials"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Lab Materials" }]} />
      <h1 className="text-2xl font-bold">Lab Materials</h1>
      <MaterialsInventory materials={materials} editable />
    </div>
  );
}
