"use client";

import { useState, useEffect, useCallback } from "react";
import { Dumbbell } from "lucide-react";
import { ExerciseProgramBuilder } from "@/components/para-medical/exercise-program-builder";
import { getCurrentUser } from "@/lib/data/client";
import type { ExerciseProgram } from "@/lib/types/para-medical";

export default function ExerciseProgramsPage() {
  const [programs, setPrograms] = useState<ExerciseProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    // Data will come from Supabase once wired
    setPrograms([]);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading exercise programs...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Exercise Programs</h1>
        </div>
      </div>
      <ExerciseProgramBuilder programs={programs} editable />
    </div>
  );
}
