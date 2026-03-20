"use client";

import { useState } from "react";
import { MachineManagement } from "@/components/dialysis/machine-management";

export default function AdminMachinesPage() {
  const [machines] = useState<Parameters<typeof MachineManagement>[0]["machines"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dialysis Machines</h1>
      <MachineManagement machines={machines} editable />
    </div>
  );
}
