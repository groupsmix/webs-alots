"use client";

import { useState, useEffect } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import {
  getCurrentUser,
  fetchBeforeAfterPhotos,
  type BeforeAfterPhotoView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

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
    return <PageLoader message="Loading photos..." />;
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
