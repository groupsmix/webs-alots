"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera } from "lucide-react";
import { ProgressPhotoGallery } from "@/components/para-medical/progress-photo-gallery";
import { getCurrentUser } from "@/lib/data/client";
import type { ProgressPhoto } from "@/lib/types/para-medical";

export default function ProgressPhotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setPhotos([]);
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Camera className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Progress Photos</h1>
      </div>
      <ProgressPhotoGallery photos={photos} />
    </div>
  );
}
