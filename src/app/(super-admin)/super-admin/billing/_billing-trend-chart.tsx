"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface BillingTrendChartProps {
  data: Array<{ label: string; amount: number }>;
  formatter: (value: number) => string;
}

export default function BillingTrendChart({ data, formatter }: BillingTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          formatter={
            ((value: number) => [formatter(value), "Encaissé"]) as unknown as React.ComponentProps<
              typeof Tooltip
            >["formatter"]
          }
          labelStyle={{ fontSize: 11 }}
          contentStyle={{ fontSize: 11 }}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill="var(--primary)"
              fillOpacity={index === data.length - 1 ? 1 : 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
