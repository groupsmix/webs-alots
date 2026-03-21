"use client";

import { useState, useEffect, useCallback } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import {
  getCurrentUser,
  fetchBeforeAfterPhotos,
  type BeforeAfterPhotoView,
} from "@/lib/data/client";

export default function PatientBeforeAfterPage() {
  const [myPhotos, setMyPhotos] = useState<BeforeAfterPhotoView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const photos = await fetchBeforeAfterPhotos(user.clinic_id, user.id);
    setMyPhotos(photos);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading photos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Before / After Photos</h1>
      <p className="text-sm text-muted-foreground">
        Visual progress of your dental treatments.
      </p>
      <BeforeAfterGallery photos={myPhotos} editable={false} />
    </div>
  );
}
