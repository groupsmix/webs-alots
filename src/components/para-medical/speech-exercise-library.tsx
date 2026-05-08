"use client";

import { Mic, Search, Clock, BookOpen } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SpeechExercise } from "@/lib/types/para-medical";

const CATEGORY_COLORS: Record<string, string> = {
  articulation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fluency: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  language: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  voice: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  pragmatics: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  phonology: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

const DIFFICULTY_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  beginner: "outline",
  intermediate: "secondary",
  advanced: "default",
};

interface SpeechExerciseLibraryProps {
  exercises: SpeechExercise[];
}

export function SpeechExerciseLibrary({ exercises }: SpeechExerciseLibraryProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);

  const categories = Array.from(new Set(exercises.map((e) => e.category)));

  const filtered = exercises.filter((ex) => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase()) && !ex.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && ex.category !== categoryFilter) return false;
    if (difficultyFilter && ex.difficulty !== difficultyFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search & filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              !categoryFilter ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
            }`}
            onClick={() => setCategoryFilter(null)}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                categoryFilter === cat ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
              }`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["beginner", "intermediate", "advanced"] as const).map((d) => (
            <button
              key={d}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                difficultyFilter === d ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
              }`}
              onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise count */}
      <p className="text-xs text-muted-foreground">{filtered.length} exercise(s) found</p>

      {/* Exercise cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 col-span-2">No exercises found.</p>
        )}
        {filtered.map((ex) => (
          <Card key={ex.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-teal-600 shrink-0" />
                  <CardTitle className="text-sm">{ex.name}</CardTitle>
                </div>
                <Badge variant={DIFFICULTY_VARIANT[ex.difficulty]} className="text-[10px]">
                  {ex.difficulty}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${CATEGORY_COLORS[ex.category] ?? ""}`}>
                  {ex.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {ex.duration_minutes} min
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{ex.description}</p>

              {ex.target_sounds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ex.target_sounds.map((sound, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{sound}</Badge>
                  ))}
                </div>
              )}

              {ex.instructions && (
                <div className="mt-2 p-2 rounded bg-muted/50">
                  <p className="text-[10px] flex items-start gap-1">
                    <BookOpen className="h-3 w-3 mt-0.5 shrink-0" />
                    {ex.instructions}
                  </p>
                </div>
              )}

              {ex.materials_needed && (
                <p className="text-[10px] text-muted-foreground mt-1">Materials: {ex.materials_needed}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
