"use client";

import { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { ProgressPhotoGallery } from "@/components/para-medical/progress-photo-gallery";
import { getCurrentUser } from "@/lib/data/client";
import type { ProgressPhoto } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function ProgressPhotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setPhotos([]);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading photos..." />;
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
