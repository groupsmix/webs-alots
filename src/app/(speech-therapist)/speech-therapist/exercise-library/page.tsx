"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen } from "lucide-react";
import { SpeechExerciseLibrary } from "@/components/para-medical/speech-exercise-library";
import { getCurrentUser } from "@/lib/data/client";
import type { SpeechExercise } from "@/lib/types/para-medical";

export default function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<SpeechExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    setExercises([]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading exercise library...</p>
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
