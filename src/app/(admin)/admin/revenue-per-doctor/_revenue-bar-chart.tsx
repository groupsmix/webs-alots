"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueBarChartProps {
  data: Array<{ name: string; revenue: number; appointments: number }>;
  intlLocale: string;
}

export default function RevenueBarChart({ data, intlLocale }: RevenueBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat(intlLocale, {
              style: "currency",
              currency: "MAD",
            }).format(Number(value))
          }
        />
        <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
