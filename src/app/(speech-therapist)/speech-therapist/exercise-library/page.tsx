"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { SpeechExerciseLibrary } from "@/components/para-medical/speech-exercise-library";
import { getCurrentUser } from "@/lib/data/client";
import type { SpeechExercise } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<SpeechExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setExercises([]);
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
    return <PageLoader message="Loading exercise library..." />;
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
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-6 w-6 text-teal-600" />
        <h1 className="text-2xl font-bold">Exercise Library</h1>
      </div>
      <SpeechExerciseLibrary exercises={exercises} />
    </div>
  );
}
