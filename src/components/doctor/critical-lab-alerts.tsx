"use client";

import { AlertOctagon, ChevronRight, TestTube2 } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CriticalLabAlert {
  id: string;
  patientName: string;
  patientId: string;
  testNames: string[];
  reportedAt: string;
}

interface CriticalLabAlertsProps {
  alerts: CriticalLabAlert[];
  className?: string;
}

export function CriticalLabAlerts({ alerts, className = "" }: CriticalLabAlertsProps) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";

  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="font-semibold text-red-600 flex items-center gap-2">
        <AlertOctagon className="h-5 w-5" />
        {lang === "ar"
          ? "نتائج مخبرية حرجة تتطلب انتباهاً فورياً"
          : "Résultats de laboratoire critiques nécessitant une attention immédiate"}
        <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full ml-1">
          {alerts.length}
        </span>
      </h3>

      <div className="grid gap-3">
        {alerts.map((alert) => (
          <Card key={alert.id} className="border-red-300 bg-red-50/50 shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-red-500" />
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-900">{alert.patientName}</span>
                  <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded">
                    {new Date(alert.reportedAt).toLocaleTimeString(
                      lang === "ar" ? "ar-MA" : "fr-MA",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </span>
                </div>
                <div className="text-sm text-red-800 flex flex-wrap gap-1">
                  {lang === "ar" ? "تحاليل غير طبيعية:" : "Valeurs anormales :"}
                  {alert.testNames.map((test, i) => (
                    <span key={test} className="font-semibold">
                      {test}
                      {i < alert.testNames.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                href={`/patients/${alert.patientId}/labs/${alert.id}`}
                className={cn(
                  buttonVariants({ size: "sm", variant: "destructive" }),
                  "shrink-0 w-full sm:w-auto",
                )}
              >
                {lang === "ar" ? "مراجعة النتائج" : "Examiner les résultats"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
