"use client";

import { useState, useEffect, useCallback } from "react";
import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import { getCurrentUser } from "@/lib/data/client";
import type { BeforeAfterPhoto } from "@/lib/dental-demo-data";

export default function PatientBeforeAfterPage() {
  const [myPhotos, setMyPhotos] = useState<BeforeAfterPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    // Before/after photos are not yet stored in Supabase DB;
    // will show empty state until R2 image upload is implemented.
    setMyPhotos([]);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Before / After Photos</h1>
      <p className="text-sm text-muted-foreground">
        Visual progress of your dental treatments.
      </p>
      <BeforeAfterGallery photos={myPhotos} editable={false} />
    </div>
  );
}
