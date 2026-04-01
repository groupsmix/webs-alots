"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MoodChartProps {
  data: { date: string; mood: number | null }[];
}

export function MoodChart({ data }: MoodChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mood Rating Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={[1, 10]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="mood" stroke="#9333ea" strokeWidth={2} dot={{ r: 4 }} name="Mood Rating" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
