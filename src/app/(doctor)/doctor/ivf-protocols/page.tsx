"use client";

import { useState } from "react";
import { ProtocolTemplates } from "@/components/ivf/protocol-templates";

export default function DoctorIVFProtocolsPage() {
  const [protocols] = useState<Parameters<typeof ProtocolTemplates>[0]["protocols"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">IVF Protocol Templates</h1>
      <ProtocolTemplates protocols={protocols} editable />
    </div>
  );
}
