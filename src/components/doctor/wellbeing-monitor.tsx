"use client";

import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  Heart,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";

interface WellbeingMetrics {
  patientsToday: number;
  patientsThisWeek: number;
  hoursWorkedToday: number;
  consecutiveDaysWorked: number;
  lastDayOff: string | null;
}

type BurnoutRisk = "low" | "moderate" | "high" | "critical";

interface WellbeingData {
  burnoutRisk: BurnoutRisk;
  score: number;
  metrics: WellbeingMetrics;
  recommendations: string[];
  alerts: string[];
}

const riskColors: Record<BurnoutRisk, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

const riskBgColors: Record<BurnoutRisk, string> = {
  low: "bg-green-50",
  moderate: "bg-yellow-50",
  high: "bg-orange-50",
  critical: "bg-red-50",
};

const riskLabels: Record<BurnoutRisk, Record<string, string>> = {
  low: { fr: "Faible", ar: "منخفض" },
  moderate: { fr: "Modéré", ar: "متوسط" },
  high: { fr: "Élevé", ar: "مرتفع" },
  critical: { fr: "Critique", ar: "حرج" },
};

export function WellbeingMonitor() {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";
  const isRtl = lang === "ar";

  const [data, setData] = useState<WellbeingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/wellbeing-check?language=${lang}`);
      const json = (await res.json()) as { ok: boolean; data?: WellbeingData; error?: string };
      if (!json.ok || !json.data) {
        setError(json.error ?? (lang === "ar" ? "خطأ في التحميل" : "Erreur de chargement"));
        return;
      }
      setData(json.data);
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        void fetchData();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">
          {lang === "ar" ? "جاري التحميل..." : "Chargement..."}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => void fetchData()}
          className="mt-3 rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          {lang === "ar" ? "إعادة المحاولة" : "Réessayer"}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { burnoutRisk, score, metrics, recommendations, alerts } = data;

  return (
    <div className={`space-y-6 ${isRtl ? "text-right" : ""}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "ar" ? "مراقبة صحة الطبيب" : "Moniteur de bien-être"}
        </h1>
        <button
          onClick={() => void fetchData()}
          className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
          title={lang === "ar" ? "تحديث" : "Actualiser"}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Risk Level Card */}
      <div className={`rounded-xl border-2 p-6 ${riskColors[burnoutRisk]}`}>
        <div className="flex items-center gap-3">
          {burnoutRisk === "critical" || burnoutRisk === "high" ? (
            <AlertTriangle className="h-8 w-8" />
          ) : (
            <Heart className="h-8 w-8" />
          )}
          <div>
            <p className="text-sm font-medium opacity-80">
              {lang === "ar" ? "مستوى خطر الإرهاق" : "Niveau de risque d'épuisement"}
            </p>
            <p className="text-3xl font-bold">{riskLabels[burnoutRisk]?.[lang] ?? burnoutRisk}</p>
          </div>
          <div className={`${isRtl ? "mr-auto" : "ml-auto"} text-right`}>
            <p className="text-sm opacity-80">{lang === "ar" ? "النتيجة" : "Score"}</p>
            <p className="text-3xl font-bold">{score}/100</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <Shield className="h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-700">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-lg border p-4 ${riskBgColors[burnoutRisk]}`}>
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="h-4 w-4" />
            <span className="text-sm">{lang === "ar" ? "مرضى اليوم" : "Patients aujourd'hui"}</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.patientsToday}</p>
        </div>

        <div className={`rounded-lg border p-4 ${riskBgColors[burnoutRisk]}`}>
          <div className="flex items-center gap-2 text-gray-600">
            <Activity className="h-4 w-4" />
            <span className="text-sm">
              {lang === "ar" ? "مرضى هذا الأسبوع" : "Patients cette semaine"}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.patientsThisWeek}</p>
        </div>

        <div className={`rounded-lg border p-4 ${riskBgColors[burnoutRisk]}`}>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {lang === "ar" ? "ساعات العمل اليوم" : "Heures aujourd'hui"}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {metrics.hoursWorkedToday}
            <span className="text-sm font-normal text-gray-500">h</span>
          </p>
        </div>

        <div className={`rounded-lg border p-4 ${riskBgColors[burnoutRisk]}`}>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">
              {lang === "ar" ? "أيام عمل متتالية" : "Jours consécutifs"}
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {metrics.consecutiveDaysWorked}
            <span className="text-sm font-normal text-gray-500">
              {lang === "ar" ? " يوم" : " j"}
            </span>
          </p>
        </div>
      </div>

      {/* Last Day Off */}
      {metrics.lastDayOff && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            {lang === "ar" ? "آخر يوم راحة:" : "Dernier jour de repos :"}
            <span className="ml-2 font-semibold text-gray-900">{metrics.lastDayOff}</span>
          </p>
        </div>
      )}

      {/* Recommendations */}
      <div className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          {lang === "ar" ? "التوصيات" : "Recommandations"}
        </h2>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 block h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
