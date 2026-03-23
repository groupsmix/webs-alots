"use client";

import { useState, useEffect } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import {
  getCurrentUser,
  fetchBeforeAfterPhotos,
  createBeforeAfterPhoto,
  type BeforeAfterPhotoView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

export default function DoctorBeforeAfterPage() {
  const [photos, setPhotos] = useState<BeforeAfterPhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const data = await fetchBeforeAfterPhotos(user.clinic_id);
      if (controller.signal.aborted) return;
    setPhotos(data);
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

  const handleAddPhoto = async (photo: Omit<BeforeAfterPhotoView, "id">) => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const newId = await createBeforeAfterPhoto({
      clinic_id: user.clinic_id,
      patient_id: photo.patientId,
      treatment_plan_id: photo.treatmentPlanId || undefined,
      description: photo.description || undefined,
      category: photo.category || undefined,
      before_date: photo.beforeDate || undefined,
      after_date: photo.afterDate ?? undefined,
    });

    setPhotos((prev) => [
      { ...photo, id: newId ?? `ba${prev.length + 1}` },
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
