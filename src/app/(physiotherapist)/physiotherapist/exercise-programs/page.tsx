"use client";

import { useState, useEffect, useCallback } from "react";
import { Dumbbell } from "lucide-react";
import { ExerciseProgramBuilder } from "@/components/para-medical/exercise-program-builder";
import { getCurrentUser } from "@/lib/data/client";
import type { ExerciseProgram } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

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
    return <PageLoader message="Loading exercise programs..." />;
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
