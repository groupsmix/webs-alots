"use client";

import { useState, useEffect } from "react";
import { Dumbbell } from "lucide-react";
import { ExerciseProgramBuilder } from "@/components/para-medical/exercise-program-builder";
import { getCurrentUser } from "@/lib/data/client";
import type { ExerciseProgram } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function ExerciseProgramsPage() {
  const [programs, setPrograms] = useState<ExerciseProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    // Data will come from Supabase once wired
    setPrograms([]);
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
