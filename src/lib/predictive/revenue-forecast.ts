/**
 * Revenue forecasting.
 *
 * Uses exponential smoothing on historical revenue data to project
 * future revenue with confidence intervals.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface RevenueForecast {
  forecastMonths: ForecastPoint[];
  trend: "increasing" | "stable" | "decreasing";
  confidenceLevel: number;
  modelType: string;
}

export interface ForecastPoint {
  month: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function forecastRevenue(
  history: MonthlyRevenue[],
  monthsAhead: number = 3,
): RevenueForecast {
  if (history.length < 3) {
    return {
      forecastMonths: [],
      trend: "stable",
      confidenceLevel: 0,
      modelType: "insufficient_data",
    };
  }

  const values = history.map((h) => h.revenue);
  const alpha = 0.3;
  const beta = 0.1;

  const { level, trendValue, residuals } = doubleExponentialSmoothing(values, alpha, beta);

  const stdDev = computeStdDev(residuals);
  const forecastMonths: ForecastPoint[] = [];

  const lastMonth = history[history.length - 1].month;

  for (let i = 1; i <= monthsAhead; i++) {
    const predicted = Math.max(0, level + trendValue * i);
    const confidence = 1.96 * stdDev * Math.sqrt(i);

    forecastMonths.push({
      month: addMonths(lastMonth, i),
      predicted: Math.round(predicted),
      lowerBound: Math.max(0, Math.round(predicted - confidence)),
      upperBound: Math.round(predicted + confidence),
    });
  }

  const trend = classifyTrend(trendValue, level);

  return {
    forecastMonths,
    trend,
    confidenceLevel: 0.95,
    modelType: "double_exponential_smoothing",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function doubleExponentialSmoothing(
  values: number[],
  alpha: number,
  beta: number,
): { level: number; trendValue: number; residuals: number[] } {
  let level = values[0];
  let trendValue = values.length > 1 ? values[1] - values[0] : 0;
  const residuals: number[] = [];

  for (let i = 1; i < values.length; i++) {
    const predicted = level + trendValue;
    residuals.push(values[i] - predicted);

    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trendValue);
    trendValue = beta * (level - prevLevel) + (1 - beta) * trendValue;
  }

  return { level, trendValue, residuals };
}

function computeStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function classifyTrend(trendValue: number, level: number): "increasing" | "stable" | "decreasing" {
  if (level === 0) return "stable";
  const relativeChange = trendValue / level;
  if (relativeChange > 0.02) return "increasing";
  if (relativeChange < -0.02) return "decreasing";
  return "stable";
}

function addMonths(yearMonth: string, months: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
