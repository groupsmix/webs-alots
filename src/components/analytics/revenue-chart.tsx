"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface RevenueDataPoint {
  name: string;
  revenue: number;
  patients: number;
}

interface RevenueChartProps {
  dailyData: RevenueDataPoint[];
  weeklyData: RevenueDataPoint[];
  monthlyData: RevenueDataPoint[];
  currency?: string;
}

export function RevenueChart({ dailyData, weeklyData, monthlyData, currency = "MAD" }: RevenueChartProps) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const data = period === "daily" ? dailyData : period === "weekly" ? weeklyData : monthlyData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue Over Time
          </CardTitle>
          <div className="flex gap-1">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p)}
                className="capitalize text-xs"
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString()} ${currency}`, "Revenue"]}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
