"use client";

import { BarChart3, TrendingUp, HeartHandshake, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OutcomeStats {
  totalCycles: number;
  completedCycles: number;
  positiveCycles: number;
  negativeCycles: number;
  ongoingCycles: number;
  cancelledCycles: number;
  averageEggsRetrieved: number;
  averageEggsFertilized: number;
  averageEmbryosTransferred: number;
  successRatePercent: number;
  cyclesByType: { type: string; count: number; positiveCount: number }[];
  monthlyOutcomes: { month: string; total: number; positive: number; negative: number }[];
}

interface OutcomeStatisticsProps {
  stats: OutcomeStats;
}

export function OutcomeStatistics({ stats }: OutcomeStatisticsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Outcome Tracking & Statistics
      </h2>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <HeartHandshake className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalCycles}</p>
              <p className="text-xs text-muted-foreground">Total Cycles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.successRatePercent}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.positiveCycles}</p>
              <p className="text-xs text-muted-foreground">Positive Results</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Averages</p>
            <div className="space-y-0.5 text-xs">
              <p>Eggs retrieved: <span className="font-medium">{stats.averageEggsRetrieved.toFixed(1)}</span></p>
              <p>Fertilized: <span className="font-medium">{stats.averageEggsFertilized.toFixed(1)}</span></p>
              <p>Transferred: <span className="font-medium">{stats.averageEmbryosTransferred.toFixed(1)}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Outcomes Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Positive", value: stats.positiveCycles, color: "bg-green-500" },
                { label: "Negative", value: stats.negativeCycles, color: "bg-red-500" },
                { label: "Ongoing", value: stats.ongoingCycles, color: "bg-blue-500" },
                { label: "Cancelled", value: stats.cancelledCycles, color: "bg-gray-400" },
              ].map((item) => {
                const pct = stats.completedCycles > 0 ? (item.value / stats.completedCycles) * 100 : 0;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs w-20">{item.label}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By Cycle Type</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.cyclesByType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {stats.cyclesByType.map((ct) => {
                  const rate = ct.count > 0 ? Math.round((ct.positiveCount / ct.count) * 100) : 0;
                  return (
                    <div key={ct.type} className="flex items-center justify-between text-xs">
                      <span className="font-medium uppercase">{ct.type.replace("_", " ")}</span>
                      <div className="flex items-center gap-2">
                        <span>{ct.count} cycles</span>
                        <Badge variant={rate > 30 ? "success" : "secondary"} className="text-[10px]">
                          {rate}% success
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      {stats.monthlyOutcomes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.monthlyOutcomes.map((mo) => (
                <div key={mo.month} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">{mo.month}</span>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="h-4 bg-green-500 rounded" style={{ width: `${mo.total > 0 ? (mo.positive / mo.total) * 100 : 0}%` }} />
                    <div className="h-4 bg-red-400 rounded" style={{ width: `${mo.total > 0 ? (mo.negative / mo.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium w-12 text-right">{mo.positive}/{mo.total}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
