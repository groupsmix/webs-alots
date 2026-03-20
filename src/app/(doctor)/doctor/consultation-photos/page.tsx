"use client";

import { useState } from "react";
import { ConsultationPhotos } from "@/components/aesthetic/consultation-photos";

export default function DoctorConsultationPhotosPage() {
  const [photos] = useState<Parameters<typeof ConsultationPhotos>[0]["photos"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Consultation Photos</h1>
      <ConsultationPhotos photos={photos} editable />
    </div>
  );
}
