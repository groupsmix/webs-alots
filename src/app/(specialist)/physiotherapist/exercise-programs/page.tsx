"use client";

import { Dumbbell } from "lucide-react";
import { useState, useEffect } from "react";
import { ExerciseProgramBuilder } from "@/components/para-medical/exercise-program-builder";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchExercisePrograms,
  addExerciseToProgram,
  removeExerciseFromProgram,
  updateExerciseProgramStatus,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { Exercise, ExerciseProgram } from "@/lib/types/para-medical";

export default function ExerciseProgramsPage() {
  const { addToast } = useToast();
  const [programs, setPrograms] = useState<ExerciseProgram[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
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
      setClinicId(user.clinic_id);
      const data = await fetchExercisePrograms(user.clinic_id);
      if (controller.signal.aborted) return;
      setPrograms(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load exercise programs", {
          context: "physiotherapist/exercise-programs",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleAddExercise(programId: string, exercise: Omit<Exercise, "id">) {
    if (!clinicId) return;
    try {
      const updatedExercises = await addExerciseToProgram(clinicId, programId, exercise);
      setPrograms((current: ExerciseProgram[]) =>
        current.map((program: ExerciseProgram) =>
          program.id === programId ? { ...program, exercises: updatedExercises } : program,
        ),
      );
    } catch (err) {
      logger.warn("Failed to add exercise", {
        context: "physiotherapist/exercise-programs",
        error: err,
      });
      addToast("Failed to add exercise", "error");
    }
  }

  async function handleRemoveExercise(programId: string, exerciseIndex: number) {
    if (!clinicId) return;
    try {
      const updatedExercises = await removeExerciseFromProgram(clinicId, programId, exerciseIndex);
      setPrograms((current: ExerciseProgram[]) =>
        current.map((program: ExerciseProgram) =>
          program.id === programId ? { ...program, exercises: updatedExercises } : program,
        ),
      );
    } catch (err) {
      logger.warn("Failed to remove exercise", {
        context: "physiotherapist/exercise-programs",
        error: err,
      });
      addToast("Failed to remove exercise", "error");
    }
  }

  async function handleUpdateStatus(programId: string, status: ExerciseProgram["status"]) {
    if (!clinicId) return;
    const previous = programs;
    setPrograms((current: ExerciseProgram[]) =>
      current.map((program: ExerciseProgram) =>
        program.id === programId ? { ...program, status } : program,
      ),
    );
    try {
      await updateExerciseProgramStatus(clinicId, programId, status);
    } catch (err) {
      logger.warn("Failed to update program status", {
        context: "physiotherapist/exercise-programs",
        error: err,
      });
      setPrograms(previous);
      addToast("Failed to update program status", "error");
    }
  }

  if (loading) return <PageLoader message="Loading exercise programs..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load exercise programs.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
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
      <ExerciseProgramBuilder
        programs={programs}
        editable
        onAddExercise={handleAddExercise}
        onRemoveExercise={handleRemoveExercise}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
