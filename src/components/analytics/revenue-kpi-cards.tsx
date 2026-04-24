"use client";

import { TrendingUp, Users, DollarSign, XCircle } from "lucide-react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";

export interface RevenueKPIs {
  totalRevenue: number;
  patientsSeen: number;
  averagePerPatient: number;
  noShowRate: number;
  revenueChange: number;
  patientsChange: number;
  currency?: string;
}

function ChangeIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  return (
    <Badge
      variant="outline"
      className={`text-xs ${
        isPositive ? "text-green-600 border-green-200" : isNegative ? "text-red-600 border-red-200" : ""
      }`}
    >
      {value > 0 ? "+" : ""}{value}%
    </Badge>
  );
}

export function RevenueKPICards({ kpis }: { kpis: RevenueKPIs }) {
  const [locale] = useLocale();

  const currency = kpis.currency ?? "MAD";

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <ChangeIndicator value={kpis.revenueChange} />
          </div>
          <p className="text-2xl font-bold">{formatNumber(kpis.totalRevenue, typeof locale !== "undefined" ? locale : "fr")} {currency}</p>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <ChangeIndicator value={kpis.patientsChange} />
          </div>
          <p className="text-2xl font-bold">{kpis.patientsSeen}</p>
          <p className="text-xs text-muted-foreground">Patients Seen</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{formatNumber(kpis.averagePerPatient, typeof locale !== "undefined" ? locale : "fr")} {currency}</p>
          <p className="text-xs text-muted-foreground">Avg per Patient</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold">{kpis.noShowRate}%</p>
          <p className="text-xs text-muted-foreground">No-Show Rate</p>
        </CardContent>
      </Card>
    </div>
  );
}
