"use client";

import { useState, useEffect } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import {
  getCurrentUser,
  fetchBeforeAfterPhotos,
  type BeforeAfterPhotoView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function PatientBeforeAfterPage() {
  const [myPhotos, setMyPhotos] = useState<BeforeAfterPhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const photos = await fetchBeforeAfterPhotos(user.clinic_id, user.id);
      if (controller.signal.aborted) return;
    setMyPhotos(photos);
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

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Before/After" }]} />
      <h1 className="text-2xl font-bold">Before / After Photos</h1>
      <p className="text-sm text-muted-foreground">
        Visual progress of your dental treatments.
      </p>
      <BeforeAfterGallery photos={myPhotos} editable={false} />
    </div>
  );
}
