"use client";

import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SystemType } from "@/lib/config/pricing";
import type { PricingTierRow } from "@/lib/super-admin-actions";
import { formatCurrency } from "@/lib/utils";

interface PricingComparisonChartProps {
  tiers: PricingTierRow[];
  selectedSystem: SystemType;
  billingCycle: "monthly" | "yearly";
  systemTypeLabels: Record<SystemType, string>;
}

export default function PricingComparisonChart({
  tiers,
  selectedSystem,
  billingCycle,
  systemTypeLabels,
}: PricingComparisonChartProps) {
  const chartData = tiers
    .filter((t) => (t.pricing[selectedSystem]?.[billingCycle] ?? 0) >= 0)
    .map((t) => ({
      name: t.name,
      price: t.pricing[selectedSystem]?.[billingCycle] ?? 0,
      popular: t.popular,
      slug: t.slug,
    }));

  if (chartData.every((d) => d.price === 0)) return null;

  return (
    <div className="rounded-xl border bg-card p-4 mb-6">
      <p className="text-xs font-medium text-muted-foreground mb-3">
        Comparaison des prix — {systemTypeLabels[selectedSystem]} ·{" "}
        {billingCycle === "monthly" ? "Mensuel" : "Annuel"}
      </p>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={(v: number) => (v === 0 ? "Gratuit" : `${(v / 1000).toFixed(0)}k`)}
          />
          <Tooltip
            formatter={
              ((value: number) => [
                value === 0 ? "Gratuit" : formatCurrency(value, "fr", "MAD"),
                "Prix",
              ]) as unknown as React.ComponentProps<typeof Tooltip>["formatter"]
            }
            labelStyle={{ fontSize: 11 }}
            contentStyle={{ fontSize: 11 }}
            cursor={{ fill: "var(--muted)" }}
          />
          <Bar dataKey="price" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill="var(--primary)"
                fillOpacity={entry.popular ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-1 text-end">
        La barre en couleur pleine = tier <span className="font-medium">Populaire</span>
      </p>
    </div>
  );
}
