"use client";

import { Stethoscope } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale } from "@/components/locale-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber } from "@/lib/utils";

export interface DoctorRevenueData {
  doctorName: string;
  revenue: number;
  patients: number;
}

interface RevenueByDoctorProps {
  data: DoctorRevenueData[];
  currency?: string;
}

/** Audit 5.2 — dynamically import recharts */
const LazyDoctorBarChart = dynamic<{ data: DoctorRevenueData[]; currency: string }>(
  () =>
    import("recharts").then((mod) => {
      const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = mod;
      function Inner({ data, currency }: { data: DoctorRevenueData[]; currency: string }) {
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="doctorName" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                formatter={(value) => [`${formatNumber(Number(value), "fr")} ${currency}`, "Revenue"]}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
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

export function RevenueByDoctor({ data, currency = "MAD" }: RevenueByDoctorProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locale] = useLocale();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Revenue by Doctor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No doctor revenue data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Revenue by Doctor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <LazyDoctorBarChart data={data} currency={currency} />
      </CardContent>
    </Card>
  );
}
