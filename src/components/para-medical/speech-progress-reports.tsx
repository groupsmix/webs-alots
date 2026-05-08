"use client";

import {
  FileText, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpeechProgressReport } from "@/lib/types/para-medical";

const PROGRESS_COLORS: Record<string, string> = {
  significant: "text-green-600",
  moderate: "text-blue-600",
  minimal: "text-orange-600",
  regression: "text-red-600",
};

const PROGRESS_ICONS: Record<string, typeof TrendingUp> = {
  significant: TrendingUp,
  moderate: TrendingUp,
  minimal: TrendingDown,
  regression: TrendingDown,
};

interface SpeechProgressReportsProps {
  reports: SpeechProgressReport[];
}

export function SpeechProgressReports({ reports }: SpeechProgressReportsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(reports[0]?.id ?? null);

  const sorted = [...reports].sort(
    (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
  );

  return (
    <div className="space-y-4">
      {sorted.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No progress reports yet.</p>
        </div>
      )}
      {sorted.map((report) => {
        const isExpanded = expandedId === report.id;
        const ProgressIcon = PROGRESS_ICONS[report.overall_progress];
        return (
          <Card key={report.id}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : report.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-teal-600" />
                  <div>
                    <CardTitle className="text-sm">{report.patient_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {report.report_date} &middot; {report.therapist_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs flex items-center gap-1 ${PROGRESS_COLORS[report.overall_progress]}`}>
                    <ProgressIcon className="h-3 w-3" />
                    {report.overall_progress}
                  </Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Period: {report.period_start} — {report.period_end}
              </p>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <p className="text-xs font-medium mb-1">Goals Summary</p>
                  <p className="text-xs text-muted-foreground">{report.goals_summary}</p>
                </div>

                <div className="p-3 rounded-lg border">
                  <p className="text-xs font-medium mb-1">Progress Summary</p>
                  <p className="text-xs text-muted-foreground">{report.progress_summary}</p>
                </div>

                {report.areas_of_improvement.length > 0 && (
                  <div className="p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Areas of Improvement
                    </p>
                    <ul className="space-y-1">
                      {report.areas_of_improvement.map((area, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-green-600 mt-1">•</span> {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.areas_of_concern.length > 0 && (
                  <div className="p-3 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                      Areas of Concern
                    </p>
                    <ul className="space-y-1">
                      {report.areas_of_concern.map((area, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-orange-600 mt-1">•</span> {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 rounded-lg border">
                  <p className="text-xs font-medium mb-1">Recommendations</p>
                  <p className="text-xs text-muted-foreground">{report.recommendations}</p>
                </div>

                <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                  <p className="text-xs font-medium mb-1">Next Steps</p>
                  <p className="text-xs text-muted-foreground">{report.next_steps}</p>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
