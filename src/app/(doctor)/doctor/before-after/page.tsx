"use client";

import { useState } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import { beforeAfterPhotos as initialPhotos, type BeforeAfterPhoto } from "@/lib/dental-demo-data";

export default function DoctorBeforeAfterPage() {
  const [photos, setPhotos] = useState<BeforeAfterPhoto[]>(initialPhotos);

  const handleAddPhoto = (photo: Omit<BeforeAfterPhoto, "id">) => {
    setPhotos((prev) => [
      { ...photo, id: `ba${prev.length + 1}` },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Before / After Photos</h1>
      <BeforeAfterGallery photos={photos} editable onAddPhoto={handleAddPhoto} />
    </div>
  );
}
