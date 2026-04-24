"use client";

import { TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser } from "@/lib/data/client";
import type { TherapySessionNote } from "@/lib/types/para-medical";

const MoodChart = dynamic(
  () => import("./mood-chart").then((m) => m.MoodChart),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" /> },
);

export default function ProgressTrackingPage() {
  const [sessions, setSessions] = useState<TherapySessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setSessions([]);
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
    return <PageLoader message="Loading progress data..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const moodData = sessions
    .filter((s) => s.mood_rating !== null)
    .map((s) => ({ date: s.session_date, mood: s.mood_rating }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">Progress Tracking</h1>
      </div>

      {moodData.length >= 2 ? (
        <MoodChart data={moodData} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Not enough data to display progress charts.</p>
            <p className="text-xs text-muted-foreground mt-1">Progress tracking will appear after recording therapy sessions with mood ratings.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
