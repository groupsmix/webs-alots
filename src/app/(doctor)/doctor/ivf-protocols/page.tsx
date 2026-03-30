"use client";

import { useState } from "react";
import { ProtocolTemplates } from "@/components/ivf/protocol-templates";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorIVFProtocolsPage() {
  const [protocols] = useState<Parameters<typeof ProtocolTemplates>[0]["protocols"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "IVF Protocols" }]} />
      <h1 className="text-2xl font-bold">IVF Protocol Templates</h1>
      <ProtocolTemplates protocols={protocols} editable />
    </div>
  );
}
