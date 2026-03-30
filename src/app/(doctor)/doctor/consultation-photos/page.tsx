"use client";

import { useState } from "react";
import { ConsultationPhotos } from "@/components/aesthetic/consultation-photos";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorConsultationPhotosPage() {
  const [photos] = useState<Parameters<typeof ConsultationPhotos>[0]["photos"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Photos" }]} />
      <h1 className="text-2xl font-bold">Consultation Photos</h1>
      <ConsultationPhotos photos={photos} editable />
    </div>
  );
}
