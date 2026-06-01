"use client";

import { TrendingDown, TrendingUp, Minus, BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  RevenueForecast as ForecastResult,
  MonthlyRevenue,
} from "@/lib/predictive/revenue-forecast";

interface RevenueForecastData {
  history: MonthlyRevenue[];
  forecast: ForecastResult;
}

export function RevenueForecastCard({ className = "" }: { className?: string }) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [months, setMonths] = useState<"1" | "3" | "6">("3");
  const [data, setData] = useState<RevenueForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchForecast() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/revenue-forecast?months=${months}`);
        const json = await res.json();
        if (json.ok) {
          setData(json.data);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    void fetchForecast();
  }, [months]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(lang === "ar" ? "ar-MA" : "fr-MA", {
      style: "currency",
      currency: "MAD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-").map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString(lang === "ar" ? "ar-MA" : "fr-MA", {
      month: "short",
      year: "numeric",
    });
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {lang === "ar" ? "توقعات الإيرادات" : "Prévisions de revenus"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            {lang === "ar" ? "فشل في تحميل التوقعات." : "Échec du chargement des prévisions."}
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendIcon =
    data?.forecast.trend === "increasing" ? (
      <TrendingUp className="h-5 w-5 text-green-500" />
    ) : data?.forecast.trend === "decreasing" ? (
      <TrendingDown className="h-5 w-5 text-red-500" />
    ) : (
      <Minus className="h-5 w-5 text-slate-500" />
    );

  const trendText =
    data?.forecast.trend === "increasing"
      ? lang === "ar"
        ? "اتجاه تصاعدي"
        : "Tendance à la hausse"
      : data?.forecast.trend === "decreasing"
        ? lang === "ar"
          ? "اتجاه تنازلي"
          : "Tendance à la baisse"
        : lang === "ar"
          ? "مستقر"
          : "Stable";

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {lang === "ar" ? "توقعات الإيرادات" : "Prévisions de revenus"}
          </CardTitle>
          <CardDescription>
            {lang === "ar"
              ? "بناءً على التنعيم الأسي المزدوج"
              : "Basé sur le lissage exponentiel double"}
          </CardDescription>
        </div>
        <Tabs value={months} onValueChange={(v) => setMonths(v as "1" | "3" | "6")}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="1" className="text-xs">
              1 {lang === "ar" ? "شهر" : "Mois"}
            </TabsTrigger>
            <TabsTrigger value="3" className="text-xs">
              3 {lang === "ar" ? "أشهر" : "Mois"}
            </TabsTrigger>
            <TabsTrigger value="6" className="text-xs">
              6 {lang === "ar" ? "أشهر" : "Mois"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {loading || !data ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.forecast.modelType === "insufficient_data" ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center">
            {lang === "ar"
              ? "بيانات تاريخية غير كافية للتنبؤ (يتطلب 3 أشهر على الأقل)."
              : "Données historiques insuffisantes pour générer une prévision (nécessite au moins 3 mois)."}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-md">
              {trendIcon}
              <span className="font-medium text-sm">{trendText}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {lang === "ar"
                  ? `مستوى الثقة ${(data.forecast.confidenceLevel * 100).toFixed(0)}%`
                  : `Niveau de confiance ${(data.forecast.confidenceLevel * 100).toFixed(0)}%`}
              </span>
            </div>

            <div className="space-y-3">
              {data.forecast.forecastMonths.map((pt) => (
                <div key={pt.month} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{formatMonth(pt.month)}</span>
                    <span className="font-bold text-primary">{formatCurrency(pt.predicted)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{lang === "ar" ? "الحد الأدنى المتوقع" : "Plage estimée"}</span>
                    <span>
                      {formatCurrency(pt.lowerBound)} - {formatCurrency(pt.upperBound)}
                    </span>
                  </div>
                  {/* Visual confidence bar */}
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex">
                    <div
                      className="bg-primary/20"
                      style={{
                        width: `${Math.max(0, (pt.lowerBound / (pt.upperBound * 1.2)) * 100)}%`,
                      }}
                    />
                    <div
                      className="bg-primary"
                      style={{
                        width: `${Math.max(2, ((pt.upperBound - pt.lowerBound) / (pt.upperBound * 1.2)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
