"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function RevenueByService({ data, currency = "MAD" }: RevenueByServiceProps) {
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
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="serviceName"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString()} ${currency}`, "Revenue"]}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
