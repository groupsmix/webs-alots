"use client";

import { useState } from "react";
import { MachineManagement } from "@/components/dialysis/machine-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorDialysisMachinesPage() {
  const [machines] = useState<Parameters<typeof MachineManagement>[0]["machines"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Dialysis Machines" }]} />
      <h1 className="text-2xl font-bold">Dialysis Machines</h1>
      <MachineManagement machines={machines} editable />
    </div>
  );
}
