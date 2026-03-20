"use client";

import { useState, useEffect, useCallback } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import {
  getCurrentUser,
  fetchBeforeAfterPhotos,
  type BeforeAfterPhotoView,
} from "@/lib/data/client";

export default function DoctorBeforeAfterPage() {
  const [photos, setPhotos] = useState<BeforeAfterPhotoView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchBeforeAfterPhotos(user.clinic_id);
    setPhotos(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading photos...</p>
      </div>
    );
  }

  const handleAddPhoto = (photo: Omit<BeforeAfterPhotoView, "id">) => {
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
