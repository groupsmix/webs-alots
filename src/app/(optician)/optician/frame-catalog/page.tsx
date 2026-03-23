"use client";

import { useState, useEffect } from "react";
import { Glasses } from "lucide-react";
import { FrameCatalog } from "@/components/para-medical/frame-catalog";
import { getCurrentUser } from "@/lib/data/client";
import type { FrameCatalogItem } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function FrameCatalogPage() {
  const [frames, setFrames] = useState<FrameCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setFrames([]);
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
    return <PageLoader message="Loading frame catalog..." />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Glasses className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Frame Catalog</h1>
      </div>
      <FrameCatalog frames={frames} />
    </div>
  );
}
