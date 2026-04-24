"use client";

import { TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber } from "@/lib/utils";

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

/**
 * Audit 5.2 — recharts loaded via next/dynamic to keep it out of the
 * initial JS bundle (~200 KB parsed). The chart renders client-side only.
 */
const RevenueAreaChart = dynamic<{ data: RevenueDataPoint[]; currency: string }>(
  () =>
    import("recharts").then((mod) => {
      const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = mod;
      function Inner({ data, currency }: { data: RevenueDataPoint[]; currency: string }) {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${formatNumber(Number(value), "fr")} ${currency}`, "Revenue"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
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

export function RevenueChart({ dailyData, weeklyData, monthlyData, currency = "MAD" }: RevenueChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locale] = useLocale();

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
        <RevenueAreaChart data={data} currency={currency} />
      </CardContent>
    </Card>
  );
}
