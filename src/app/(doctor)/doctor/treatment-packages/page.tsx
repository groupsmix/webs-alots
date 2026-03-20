"use client";

import { useState } from "react";
import { TreatmentPackages } from "@/components/aesthetic/treatment-packages";

export default function DoctorTreatmentPackagesPage() {
  const [packages] = useState<Parameters<typeof TreatmentPackages>[0]["packages"]>([]);
  const [patientPackages] = useState<Parameters<typeof TreatmentPackages>[0]["patientPackages"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Treatment Packages</h1>
      <TreatmentPackages packages={packages} patientPackages={patientPackages} editable />
    </div>
  );
}
