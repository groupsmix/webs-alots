"use client";

import { Clock, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  predictWaitTime,
  type QueueState,
  type WaitTimeEstimate,
} from "@/lib/algorithms/wait-time-predictor";

export function EstimatedWaitTime({ className = "" }: { className?: string }) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [estimate, setEstimate] = useState<WaitTimeEstimate | null>(null);

  useEffect(() => {
    // In a real application, this state would be fetched via WebSocket or polling
    // from the clinic's live queue management system.
    const mockState: QueueState = {
      patientsInQueue: 2,
      walkInsInQueue: 1,
      averageConsultationDurationMinutes: 15,
      doctorDelayMinutes: 10,
      currentConsultationStartTime: new Date(Date.now() - 10 * 60000).toISOString(), // Started 10 mins ago
    };

    setEstimate(predictWaitTime(mockState));

    // Auto-update every minute
    const interval = setInterval(() => {
      setEstimate(predictWaitTime(mockState));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!estimate) return null;

  const statusColor =
    estimate.status === "on-time"
      ? "text-green-600 bg-green-50 border-green-200"
      : estimate.status === "delayed"
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-red-600 bg-red-50 border-red-200";

  const statusText =
    estimate.status === "on-time"
      ? lang === "ar"
        ? "في الموعد"
        : "À l'heure"
      : estimate.status === "delayed"
        ? lang === "ar"
          ? "تأخير طفيف"
          : "Léger retard"
        : lang === "ar"
          ? "تأخير كبير"
          : "Retard important";

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div
        className={`h-1.5 w-full ${estimate.status === "on-time" ? "bg-green-500" : estimate.status === "delayed" ? "bg-amber-500" : "bg-red-500"}`}
      />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {lang === "ar" ? "الوقت المقدر للانتظار" : "Temps d'attente estimé"}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
            {statusText}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tighter">{estimate.estimatedMinutes}</span>
            <span className="text-muted-foreground font-medium">
              {lang === "ar" ? "دقيقة" : "min"}
            </span>
          </div>
          <span className="text-sm text-muted-foreground mt-1">
            ({lang === "ar" ? "بين" : "Entre"} {estimate.timeRange.min} {lang === "ar" ? "و" : "et"}{" "}
            {estimate.timeRange.max} {lang === "ar" ? "دقيقة" : "min"})
          </span>
        </div>

        <div className="flex items-start gap-2 bg-muted/40 p-3 rounded-lg text-sm border">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground leading-snug">{estimate.explanation[lang]}</p>
        </div>
      </CardContent>
    </Card>
  );
}
