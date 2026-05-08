"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MoodChartProps {
  data: { date: string; mood: number | null }[];
}

/** Audit 5.2 — dynamically import recharts */
const LazyMoodLine = dynamic<{ data: { date: string; mood: number | null }[] }>(
  () =>
    import("recharts").then((mod) => {
      const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = mod;
      function Inner({ data }: { data: { date: string; mood: number | null }[] }) {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[1, 10]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="mood" stroke="#9333ea" strokeWidth={2} dot={{ r: 4 }} name="Mood Rating" />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      return { default: Inner };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg animate-pulse">
        <span className="text-sm text-muted-foreground">Loading chart…</span>
      </div>
    ),
  },
);

export function MoodChart({ data }: MoodChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mood Rating Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <LazyMoodLine data={data} />
      </CardContent>
    </Card>
  );
}
