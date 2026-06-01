"use client";

import { CalendarClock, CheckCircle, ChevronRight, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { suggestFollowUp, type FollowUpSuggestion } from "@/lib/algorithms/follow-up-scheduler";

interface FollowUpSuggestionsProps {
  diagnosisCodes: string[];
  patientId: string;
  consultationId: string;
  className?: string;
  onSchedule?: (date: Date) => void;
}

export function FollowUpSuggestions({
  diagnosisCodes,
  patientId: _patientId,
  consultationId: _consultationId,
  className = "",
  onSchedule,
}: FollowUpSuggestionsProps) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  const [suggestion, setSuggestion] = useState<FollowUpSuggestion | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);

  useEffect(() => {
    // Generate suggestion based on diagnosis codes
    const result = suggestFollowUp(diagnosisCodes);
    setSuggestion(result);
  }, [diagnosisCodes]);

  if (!suggestion) return null;

  const handleSchedule = () => {
    // Call the parent callback, or trigger a local API call if preferred
    if (onSchedule) {
      onSchedule(suggestion.recommendedDate);
    }
    setIsScheduled(true);
  };

  const priorityColor =
    suggestion.priority === "urgent"
      ? "text-red-600 bg-red-100 border-red-200"
      : suggestion.priority === "important"
        ? "text-amber-600 bg-amber-100 border-amber-200"
        : "text-blue-600 bg-blue-100 border-blue-200";

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          {lang === "ar" ? "اقتراح المتابعة الذكية" : "Suggestion de suivi intelligent"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isScheduled ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md border border-green-200">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">
              {lang === "ar"
                ? "تمت جدولة المتابعة بنجاح."
                : "Rendez-vous de suivi programmé avec succès."}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {lang === "ar" ? "في غضون" : "Dans"} {suggestion.intervalDays}{" "}
                    {lang === "ar" ? "يوماً" : "jours"}
                  </span>
                  <Badge variant="outline" className={`ml-2 text-xs font-normal ${priorityColor}`}>
                    {lang === "ar" && suggestion.priority === "urgent"
                      ? "عاجل"
                      : lang === "ar" && suggestion.priority === "important"
                        ? "هام"
                        : lang === "ar"
                          ? "روتيني"
                          : suggestion.priority === "urgent"
                            ? "Urgent"
                            : suggestion.priority === "important"
                              ? "Important"
                              : "Routine"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {suggestion.recommendedDate.toLocaleDateString(
                    lang === "ar" ? "ar-MA" : "fr-MA",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </p>
              </div>
              <Button size="sm" onClick={handleSchedule} className="w-full sm:w-auto">
                {lang === "ar" ? "جدولة المتابعة" : "Programmer le suivi"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="bg-background/60 p-3 rounded-md border text-sm">
              <span className="font-medium mr-2">
                {lang === "ar" ? "السبب:" : "Justification :"}
              </span>
              <span className="text-muted-foreground">{suggestion.rationale[lang]}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
