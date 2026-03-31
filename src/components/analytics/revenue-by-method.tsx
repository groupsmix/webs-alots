"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const METHOD_COLORS: Record<string, string> = {
  cash: "#16a34a",
  card: "#2563eb",
  insurance: "#7c3aed",
  online_transfer: "#ea580c",
  cheque: "#ca8a04",
  other: "#6b7280",
};

export interface PaymentMethodData {
  method: string;
  label: string;
  revenue: number;
  count: number;
  percentage: number;
}

interface RevenueByMethodProps {
  data: PaymentMethodData[];
  currency?: string;
}

export function RevenueByMethod({ data, currency = "MAD" }: RevenueByMethodProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Revenue by Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No payment data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Revenue by Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, _name, props) => {
                const entry = props.payload as PaymentMethodData;
                return [`${Number(value).toLocaleString()} ${currency} (${entry.percentage}%)`, "Revenue"];
              }}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={METHOD_COLORS[entry.method] ?? METHOD_COLORS.other}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {data.map((entry) => (
            <div key={entry.method} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: METHOD_COLORS[entry.method] ?? METHOD_COLORS.other }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.label}: {entry.count} payments
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
