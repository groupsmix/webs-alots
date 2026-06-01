"use client";

import { AlertCircle, AlertTriangle, CalendarCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { NoShowPrediction } from "@/lib/predictive/no-show-model";

interface NoShowIndicatorProps {
  appointmentId: string;
  className?: string;
  showDetails?: boolean;
}

export function NoShowIndicator({
  appointmentId,
  className = "",
  showDetails = false,
}: NoShowIndicatorProps) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [prediction, setPrediction] = useState<NoShowPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchRisk() {
      try {
        setLoading(true);
        const res = await fetch(`/api/appointments/no-show-risk?appointmentId=${appointmentId}`);
        const json = await res.json();
        if (json.ok) {
          setPrediction(json.data.prediction);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    void fetchRisk();
  }, [appointmentId]);

  if (loading) {
    return <Loader2 className={`h-4 w-4 animate-spin text-muted-foreground ${className}`} />;
  }

  if (error || !prediction) {
    return null; // Silent fail for prediction
  }

  const config = {
    low: {
      color: "bg-green-100 text-green-800 border-green-200",
      icon: CalendarCheck,
      iconColor: "text-green-600",
      label: { fr: "Risque Faible", ar: "خطر منخفض" },
    },
    medium: {
      color: "bg-amber-100 text-amber-800 border-amber-200",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      label: { fr: "Risque Moyen", ar: "خطر متوسط" },
    },
    high: {
      color: "bg-red-100 text-red-800 border-red-200",
      icon: AlertCircle,
      iconColor: "text-red-600",
      label: { fr: "Risque Élevé", ar: "خطر مرتفع" },
    },
  };

  const riskConfig = config[prediction.riskLevel];
  const Icon = riskConfig.icon;
  const probabilityPercent = Math.round(prediction.probability * 100);

  const IndicatorBadge = (
    <Badge variant="outline" className={`gap-1 ${riskConfig.color} ${className}`}>
      <Icon className={`h-3 w-3 ${riskConfig.iconColor}`} />
      <span>
        {riskConfig.label[lang]} ({probabilityPercent}%)
      </span>
    </Badge>
  );

  if (!showDetails) {
    // The codebase Tooltip accepts a plain-string `content` prop, so we
    // flatten the rich content (risk factors + recommendation) into a
    // single multi-line string. Newlines render via white-space wrapping
    // on the tooltip; we strip the auto whitespace-nowrap when used here.
    const factorsHeading =
      lang === "ar" ? "عوامل الخطر الرئيسية:" : "Principaux facteurs de risque :";
    const recommendationLabel = lang === "ar" ? "توصية:" : "Recommandation :";
    const tooltipText = [
      factorsHeading,
      ...prediction.topRiskFactors.map((factor) => `• ${factor[lang]}`),
      "",
      `${recommendationLabel} ${prediction.recommendation[lang]}`,
    ].join("\n");

    return (
      <Tooltip content={tooltipText} className="max-w-xs whitespace-pre-line">
        <div className="inline-flex cursor-help">{IndicatorBadge}</div>
      </Tooltip>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div
        className={`h-1 w-full ${prediction.riskLevel === "high" ? "bg-red-500" : prediction.riskLevel === "medium" ? "bg-amber-500" : "bg-green-500"}`}
      />
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-sm">
            {lang === "ar" ? "توقع الحضور" : "Prédiction de présence"}
          </h4>
          {IndicatorBadge}
        </div>

        {prediction.riskLevel !== "low" && (
          <div className="space-y-2 text-sm bg-muted/50 p-3 rounded-md">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
              {lang === "ar" ? "عوامل الخطر" : "Facteurs de risque"}
            </p>
            <ul className="space-y-1">
              {prediction.topRiskFactors.map((factor) => (
                <li key={factor.key} className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <span className="text-muted-foreground">{factor[lang]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-primary/5 p-3 rounded-md text-sm border border-primary/10">
          <p className="font-medium text-xs text-primary uppercase tracking-wider mb-1">
            {lang === "ar" ? "الإجراء الموصى به" : "Action recommandée"}
          </p>
          <p className="text-foreground">{prediction.recommendation[lang]}</p>
        </div>
      </CardContent>
    </Card>
  );
}
