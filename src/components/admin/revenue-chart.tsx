"use client";

import { useState } from "react";
import { TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Period = "daily" | "weekly" | "monthly";

/**
 * RevenueChart
 *
 * Displays daily/weekly/monthly revenue charts for the clinic admin.
 */
export function RevenueChart() {
  const [period, setPeriod] = useState<Period>("weekly");

  const data: Record<Period, { labels: string[]; values: number[]; total: number; change: number }> = {
    daily: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      values: [3200, 4100, 2800, 5200, 4500, 2100, 0],
      total: 21900,
      change: 5.2,
    },
    weekly: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      values: [18500, 22300, 19800, 24100],
      total: 84700,
      change: 12.3,
    },
    monthly: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      values: [72000, 68500, 81000, 76200, 84700, 89500],
      total: 471900,
      change: 8.7,
    },
  };

  const currentData = data[period];
  const maxValue = Math.max(...currentData.values);

  const topServices = [
    { name: "General Consultation", revenue: 32000, count: 128, percentage: 38 },
    { name: "Follow-up Visit", revenue: 18500, count: 74, percentage: 22 },
    { name: "Blood Test", revenue: 12800, count: 64, percentage: 15 },
    { name: "Vaccination", revenue: 9600, count: 48, percentage: 11 },
    { name: "ECG", revenue: 7200, count: 24, percentage: 9 },
    { name: "Other", revenue: 4600, count: 23, percentage: 5 },
  ];

  const paymentMethods = [
    { method: "Cash", amount: 42350, percentage: 50 },
    { method: "Card", amount: 29645, percentage: 35 },
    { method: "Insurance", amount: 12705, percentage: 15 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{currentData.total.toLocaleString()} MAD</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {currentData.change > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-600" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${currentData.change > 0 ? "text-green-600" : "text-red-600"}`}>
                {currentData.change}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Average per Day</p>
            <p className="text-2xl font-bold">{Math.round(currentData.total / currentData.labels.length).toLocaleString()} MAD</p>
            <p className="text-xs text-muted-foreground mt-2">Across {currentData.labels.length} periods</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold">8,400 MAD</p>
            <p className="text-xs text-muted-foreground mt-2">12 unpaid invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Trend
            </CardTitle>
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p)}
                  className="capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-48">
            {currentData.values.map((value, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {(value / 1000).toFixed(1)}k
                </span>
                <div
                  className="w-full bg-primary/80 rounded-t-sm transition-all hover:bg-primary"
                  style={{ height: `${maxValue > 0 ? (value / maxValue) * 160 : 0}px` }}
                />
                <span className="text-[10px] text-muted-foreground">{currentData.labels[i]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topServices.map((service) => (
                <div key={service.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{service.name}</span>
                    <span className="font-medium">{service.revenue.toLocaleString()} MAD</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${service.percentage}%` }} />
                    </div>
                    <Badge variant="outline" className="text-[10px]">{service.count} visits</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paymentMethods.map((pm) => (
                <div key={pm.method}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{pm.method}</span>
                    <span className="font-medium">{pm.amount.toLocaleString()} MAD ({pm.percentage}%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pm.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Collection Summary</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-lg font-bold text-green-600">{(currentData.total * 0.88).toLocaleString()} MAD</p>
                  <p className="text-xs text-muted-foreground">Collected</p>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-lg font-bold text-red-600">8,400 MAD</p>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
