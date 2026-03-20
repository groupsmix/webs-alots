"use client";

import { useState } from "react";
import {
  Dumbbell, Plus, Trash2, ChevronDown, ChevronUp,
  Play, Pause, CheckCircle, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExerciseProgram, Exercise } from "@/lib/types/para-medical";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "outline"> = {
  active: "default",
  completed: "success",
  paused: "secondary",
};

interface ExerciseProgramBuilderProps {
  programs: ExerciseProgram[];
  editable?: boolean;
  onAddExercise?: (programId: string, exercise: Omit<Exercise, "id">) => void;
  onRemoveExercise?: (programId: string, exerciseIndex: number) => void;
  onUpdateStatus?: (programId: string, status: ExerciseProgram["status"]) => void;
}

const EMPTY_EXERCISE: Omit<Exercise, "id"> = {
  name: "",
  category: "strengthening",
  description: "",
  sets: 3,
  reps: 10,
  duration_seconds: null,
  rest_seconds: 60,
  notes: null,
  image_url: null,
};

const CATEGORIES = [
  "strengthening", "stretching", "balance", "cardio",
  "mobility", "coordination", "posture", "breathing",
];

export function ExerciseProgramBuilder({
  programs,
  editable = false,
  onAddExercise,
  onRemoveExercise,
  onUpdateStatus,
}: ExerciseProgramBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(programs[0]?.id ?? null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState(EMPTY_EXERCISE);

  const handleAdd = (programId: string) => {
    if (newExercise.name.trim() && onAddExercise) {
      onAddExercise(programId, { ...newExercise, name: newExercise.name.trim() });
      setNewExercise(EMPTY_EXERCISE);
      setAdding(null);
    }
  };

  return (
    <div className="space-y-4">
      {programs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No exercise programs yet.</p>
      )}
      {programs.map((program) => {
        const isExpanded = expandedId === program.id;
        return (
          <Card key={program.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : program.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-sm">{program.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {program.patient_name} &middot; {program.frequency} &middot; {program.exercises.length} exercises
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[program.status]} className="text-xs">
                    {program.status}
                  </Badge>
                  {editable && program.status === "active" && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdateStatus?.(program.id, "paused"); }}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {editable && program.status === "paused" && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdateStatus?.(program.id, "active"); }}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {editable && program.status !== "completed" && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onUpdateStatus?.(program.id, "completed"); }}>
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>Start: {program.start_date}</span>
                {program.end_date && <span>End: {program.end_date}</span>}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {program.exercises.map((ex, idx) => (
                    <div key={ex.id || idx} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Dumbbell className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{ex.name}</p>
                          <Badge variant="outline" className="text-[10px]">{ex.category}</Badge>
                        </div>
                        {ex.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ex.description}</p>
                        )}
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{ex.sets} sets × {ex.reps} reps</span>
                          {ex.duration_seconds && <span><Clock className="h-3 w-3 inline" /> {ex.duration_seconds}s</span>}
                          <span>Rest: {ex.rest_seconds}s</span>
                        </div>
                      </div>
                      {editable && (
                        <Button variant="ghost" size="sm" onClick={() => onRemoveExercise?.(program.id, idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {editable && (
                  <div className="mt-3">
                    {adding === program.id ? (
                      <div className="space-y-3 p-3 border rounded-lg">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Exercise Name</Label>
                            <Input value={newExercise.name} onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })} placeholder="e.g. Quadriceps Stretch" className="text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Category</Label>
                            <select className="w-full rounded-md border px-3 py-2 text-sm" value={newExercise.category} onChange={(e) => setNewExercise({ ...newExercise, category: e.target.value })}>
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Textarea value={newExercise.description} onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })} placeholder="Instructions..." rows={2} className="text-sm" />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">Sets</Label>
                            <Input type="number" value={newExercise.sets} onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) || 0 })} className="text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Reps</Label>
                            <Input type="number" value={newExercise.reps} onChange={(e) => setNewExercise({ ...newExercise, reps: parseInt(e.target.value) || 0 })} className="text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Duration (s)</Label>
                            <Input type="number" value={newExercise.duration_seconds ?? ""} onChange={(e) => setNewExercise({ ...newExercise, duration_seconds: e.target.value ? parseInt(e.target.value) : null })} className="text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Rest (s)</Label>
                            <Input type="number" value={newExercise.rest_seconds} onChange={(e) => setNewExercise({ ...newExercise, rest_seconds: parseInt(e.target.value) || 0 })} className="text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAdd(program.id)}>Add Exercise</Button>
                          <Button size="sm" variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(program.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Exercise
                      </Button>
                    )}
                  </div>
                )}

                {program.notes && (
                  <div className="mt-3 p-3 border rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground"><strong>Notes:</strong> {program.notes}</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
