"use client";

import { useState, useMemo } from "react";
import { Scale, TrendingUp, TrendingDown, Minus, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import dynamic from "next/dynamic";
import type { BodyMeasurement } from "@/lib/types/para-medical";

interface ChartDataPoint {
  date: string;
  weight: number | null;
  bmi: number | null;
  bodyFat: number | null;
}

/** Audit 5.2 — dynamically import recharts */
const LazyBodyChart = dynamic<{ chartData: ChartDataPoint[] }>(
  () =>
    import("recharts").then((mod) => {
      const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = mod;
      function Inner({ chartData }: { chartData: ChartDataPoint[] }) {
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="weight" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="bmi" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#3b82f6" name="Weight (kg)" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="bmi" type="monotone" dataKey="bmi" stroke="#f59e0b" name="BMI" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
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

interface BodyMeasurementTrackerProps {
  measurements: BodyMeasurement[];
  onAdd?: (measurement: Omit<BodyMeasurement, "id" | "created_at">) => void;
}

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", color: "text-orange-600" };
  return { label: "Obese", color: "text-red-600" };
}

export function BodyMeasurementTracker({ measurements }: BodyMeasurementTrackerProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [calcWeight, setCalcWeight] = useState("");
  const [calcHeight, setCalcHeight] = useState("");

  const sorted = useMemo(
    () => [...measurements].sort((a, b) => new Date(a.measurement_date).getTime() - new Date(b.measurement_date).getTime()),
    [measurements],
  );

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  const weightChange = latest && previous && latest.weight_kg && previous.weight_kg
    ? latest.weight_kg - previous.weight_kg
    : null;

  const chartData = sorted.map((m) => ({
    date: m.measurement_date,
    weight: m.weight_kg,
    bmi: m.bmi,
    bodyFat: m.body_fat_pct,
  }));

  const calcBMI = calcWeight && calcHeight
    ? (parseFloat(calcWeight) / ((parseFloat(calcHeight) / 100) ** 2)).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* Current stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Scale className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold">{latest?.weight_kg ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Weight (kg)</p>
            {weightChange !== null && (
              <div className="flex items-center justify-center gap-1 mt-1">
                {weightChange > 0 ? (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                ) : weightChange < 0 ? (
                  <TrendingDown className="h-3 w-3 text-green-600" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs">{weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} kg</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{latest?.bmi?.toFixed(1) ?? "—"}</p>
            <p className="text-xs text-muted-foreground">BMI</p>
            {latest?.bmi && (
              <Badge variant="outline" className={`text-[10px] mt-1 ${getBMICategory(latest.bmi).color}`}>
                {getBMICategory(latest.bmi).label}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{latest?.body_fat_pct ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Body Fat %</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{latest?.waist_cm ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Waist (cm)</p>
          </CardContent>
        </Card>
      </div>

      {/* BMI Calculator */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowCalc(!showCalc)}>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            BMI Calculator
          </CardTitle>
        </CardHeader>
        {showCalc && (
          <CardContent>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs">Weight (kg)</Label>
                <Input type="number" value={calcWeight} onChange={(e) => setCalcWeight(e.target.value)} placeholder="70" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Height (cm)</Label>
                <Input type="number" value={calcHeight} onChange={(e) => setCalcHeight(e.target.value)} placeholder="170" className="text-sm" />
              </div>
              <div className="text-center">
                {calcBMI && (
                  <div>
                    <p className="text-2xl font-bold">{calcBMI}</p>
                    <Badge variant="outline" className={`text-[10px] ${getBMICategory(parseFloat(calcBMI)).color}`}>
                      {getBMICategory(parseFloat(calcBMI)).label}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
              <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/20"><span className="font-medium text-blue-600">&lt;18.5</span><br />Underweight</div>
              <div className="p-1 rounded bg-green-50 dark:bg-green-950/20"><span className="font-medium text-green-600">18.5–24.9</span><br />Normal</div>
              <div className="p-1 rounded bg-orange-50 dark:bg-orange-950/20"><span className="font-medium text-orange-600">25–29.9</span><br />Overweight</div>
              <div className="p-1 rounded bg-red-50 dark:bg-red-950/20"><span className="font-medium text-red-600">&ge;30</span><br />Obese</div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Weight & BMI chart */}
      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Weight & BMI History</CardTitle>
          </CardHeader>
          <CardContent>
            <LazyBodyChart chartData={chartData} />
          </CardContent>
        </Card>
      )}

      {/* BMI History table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Measurement History</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No measurements recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1">Date</th>
                    <th className="text-right py-2 px-1">Weight</th>
                    <th className="text-right py-2 px-1">BMI</th>
                    <th className="text-right py-2 px-1">Fat %</th>
                    <th className="text-right py-2 px-1">Waist</th>
                    <th className="text-right py-2 px-1">Hip</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sorted].reverse().map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 px-1">{m.measurement_date}</td>
                      <td className="text-right py-2 px-1">{m.weight_kg ?? "—"}</td>
                      <td className="text-right py-2 px-1">
                        {m.bmi ? (
                          <span className={getBMICategory(m.bmi).color}>{m.bmi.toFixed(1)}</span>
                        ) : "—"}
                      </td>
                      <td className="text-right py-2 px-1">{m.body_fat_pct ?? "—"}</td>
                      <td className="text-right py-2 px-1">{m.waist_cm ?? "—"}</td>
                      <td className="text-right py-2 px-1">{m.hip_cm ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
