"use client";

import { BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale } from "@/components/locale-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#16a34a", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5",
];

export interface ServiceRevenueData {
  serviceName: string;
  revenue: number;
  count: number;
}

interface RevenueByServiceProps {
  data: ServiceRevenueData[];
  currency?: string;
}

/** Audit 5.2 — dynamically import recharts */
const LazyServicePie = dynamic<{ data: ServiceRevenueData[]; currency: string; colors: string[] }>(
  () =>
    import("recharts").then((mod) => {
      const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } = mod;
      function Inner({ data, currency, colors }: { data: ServiceRevenueData[]; currency: string; colors: string[] }) {
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="serviceName"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${formatNumber(Number(value), "fr")} ${currency}`, "Revenue"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      }
      return { default: Inner };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[250px] bg-muted/20 rounded-lg animate-pulse">
        <span className="text-sm text-muted-foreground">Loading chart…</span>
      </div>
    ),
  },
);

export function RevenueByService({ data, currency = "MAD" }: RevenueByServiceProps) {
  const [locale] = useLocale();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Revenue by Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No service revenue data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Revenue by Service
        </CardTitle>
      </CardHeader>
      <CardContent>
        <LazyServicePie data={data} currency={currency} colors={COLORS} />
      </CardContent>
    </Card>
  );
}
