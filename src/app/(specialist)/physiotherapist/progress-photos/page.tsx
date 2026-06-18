"use client";

import { Camera } from "lucide-react";
import { useState, useEffect } from "react";
import { ProgressPhotoGallery } from "@/components/para-medical/progress-photo-gallery";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser, fetchProgressPhotos } from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { ProgressPhoto } from "@/lib/types/para-medical";

export default function ProgressPhotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const data = await fetchProgressPhotos(user.clinic_id);
      if (controller.signal.aborted) return;
      setPhotos(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load progress photos", {
          context: "physiotherapist/progress-photos",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  if (loading) return <PageLoader message="Loading photos..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load progress photos.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
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
