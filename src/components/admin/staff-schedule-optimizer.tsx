"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  optimizeStaffSchedule,
  type OptimizationResult,
  type HourlyVolume,
} from "@/lib/algorithms/staff-optimizer";

// Mock data for demonstration until API is connected
const generateMockData = (): HourlyVolume[] => {
  const data: HourlyVolume[] = [];
  // Monday to Friday
  for (let day = 1; day <= 5; day++) {
    // 8 AM to 6 PM
    for (let hour = 8; hour <= 18; hour++) {
      let avgPatients = 0;
      const currentStaff = 2; // Default 2 staff

      // Morning rush
      if (hour >= 9 && hour <= 11) {
        avgPatients = 12 + Math.random() * 5;
        if (day === 1) avgPatients += 4; // Monday is busier
      }
      // Lunch lull
      else if (hour >= 12 && hour <= 14) {
        avgPatients = 3 + Math.random() * 3;
      }
      // Afternoon steady
      else {
        avgPatients = 6 + Math.random() * 4;
      }

      data.push({
        dayOfWeek: day,
        hour,
        averagePatients: avgPatients,
        currentStaff,
      });
    }
  }
  return data;
};

export function StaffScheduleOptimizer({ className = "" }: { className?: string }) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [result, setResult] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    // In a real app, we'd fetch the HourlyVolume[] from an API
    const mockData = generateMockData();
    setResult(optimizeStaffSchedule(mockData));
  }, []);

  if (!result) return null;

  const daysMap: Record<number, { fr: string; ar: string }> = {
    0: { fr: "Dimanche", ar: "الأحد" },
    1: { fr: "Lundi", ar: "الإثنين" },
    2: { fr: "Mardi", ar: "الثلاثاء" },
    3: { fr: "Mercredi", ar: "الأربعاء" },
    4: { fr: "Jeudi", ar: "الخميس" },
    5: { fr: "Vendredi", ar: "الجمعة" },
    6: { fr: "Samedi", ar: "السبت" },
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {lang === "ar" ? "تحسين جدول الموظفين" : "Optimisation des effectifs"}
        </CardTitle>
        <CardDescription>
          {lang === "ar"
            ? "توصيات تعتمد على تحليل حجم المرضى التاريخي"
            : "Recommandations basées sur l'analyse du volume historique des patients"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-100 p-3 rounded-lg flex flex-col justify-center">
            <span className="text-xs text-green-700 font-medium mb-1">
              {lang === "ar" ? "التوفير الأسبوعي المحتمل" : "Économies hebdo. potentielles"}
            </span>
            <span className="text-xl font-bold text-green-700 flex items-center gap-1">
              <ArrowDownRight className="h-4 w-4" />
              {result.totalWeeklySavings} MAD
            </span>
          </div>

          <div
            className={`${result.criticalUnderstaffedHours > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"} p-3 rounded-lg flex flex-col justify-center`}
          >
            <span
              className={`text-xs font-medium mb-1 ${result.criticalUnderstaffedHours > 0 ? "text-red-700" : "text-slate-700"}`}
            >
              {lang === "ar" ? "ساعات النقص الحرج" : "Heures en sous-effectif critique"}
            </span>
            <span
              className={`text-xl font-bold flex items-center gap-1 ${result.criticalUnderstaffedHours > 0 ? "text-red-700" : "text-slate-700"}`}
            >
              {result.criticalUnderstaffedHours > 0 && <AlertTriangle className="h-4 w-4" />}
              {result.criticalUnderstaffedHours} {lang === "ar" ? "ساعة" : "h"}
            </span>
          </div>
        </div>

        {/* Top Suggestions List */}
        <div className="space-y-3 mt-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {lang === "ar" ? "أهم التوصيات" : "Principales recommandations"}
          </h4>

          {result.suggestions.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md border border-green-100">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">
                {lang === "ar" ? "جدولك الحالي مثالي." : "Votre planning actuel est optimal."}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {result.suggestions.slice(0, 5).map((sug, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                  <div
                    className={`mt-0.5 p-1.5 rounded-full ${
                      sug.status === "understaffed"
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {sug.status === "understaffed" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {daysMap[sug.dayOfWeek]?.[lang]} à {sug.hour}h00
                      </span>
                      <Badge
                        variant={sug.status === "understaffed" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {sug.suggestedStaff} {lang === "ar" ? "موظفين مطلوبين" : "employés requis"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {sug.reasoning[lang]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
