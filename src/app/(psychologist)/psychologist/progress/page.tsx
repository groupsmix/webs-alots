"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getCurrentUser } from "@/lib/data/client";
import type { TherapySessionNote } from "@/lib/types/para-medical";
import { PageLoader } from "@/components/ui/page-loader";

export default function ProgressTrackingPage() {
  const [sessions, setSessions] = useState<TherapySessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<Error | null>(null);

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mood Rating Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 10]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="#9333ea" strokeWidth={2} dot={{ r: 4 }} name="Mood Rating" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
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
