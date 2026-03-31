"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DoctorRevenueData {
  doctorName: string;
  revenue: number;
  patients: number;
}

interface RevenueByDoctorProps {
  data: DoctorRevenueData[];
  currency?: string;
}

export function RevenueByDoctor({ data, currency = "MAD" }: RevenueByDoctorProps) {
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
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="doctorName" type="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString()} ${currency}`, "Revenue"]}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
