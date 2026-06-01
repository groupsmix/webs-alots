"use client";

import { AlertCircle, ArrowUpRight, CheckCircle2, MessageSquare, Phone, UserX } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { predictChurn, type ChurnPrediction, type PatientHistoryFeatures } from "@/lib/algorithms/patient-churn-predictor";

interface AtRiskPatient {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
  features: PatientHistoryFeatures;
  prediction?: ChurnPrediction;
}

// Mock data
const MOCK_PATIENTS: AtRiskPatient[] = [
  {
    id: "pat-01",
    name: "Ahmed Alami",
    phone: "+212 600-000001",
    lastVisit: "2025-10-15T10:00:00Z",
    features: { totalVisits: 1, daysSinceLastVisit: 230, cancellationRate: 0.5, averageDaysBetweenVisits: 0 }
  },
  {
    id: "pat-02",
    name: "Fatima Bennani",
    phone: "+212 600-000002",
    lastVisit: "2025-11-20T14:30:00Z",
    features: { totalVisits: 3, daysSinceLastVisit: 195, cancellationRate: 0.2, averageDaysBetweenVisits: 45, lastVisitSatisfactionScore: 2 }
  },
  {
    id: "pat-03",
    name: "Youssef Tazi",
    phone: "+212 600-000003",
    lastVisit: "2026-01-05T09:15:00Z",
    features: { totalVisits: 2, daysSinceLastVisit: 150, cancellationRate: 0, averageDaysBetweenVisits: 30 }
  }
];

export function AtRiskPatients({ className = "" }: { className?: string }) {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";
  
  const [patients, setPatients] = useState<AtRiskPatient[]>([]);

  useEffect(() => {
    // Process predictions
    const scored = MOCK_PATIENTS.map(p => ({
      ...p,
      prediction: predictChurn(p.features)
    }))
    .filter(p => p.prediction.riskLevel === "high" || p.prediction.riskLevel === "medium")
    .sort((a, b) => b.prediction!.churnProbability - a.prediction!.churnProbability);
    
    setPatients(scored);
  }, []);

  const getRiskBadge = (level: string) => {
    if (level === "high") {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">{lang === "ar" ? "خطر مرتفع" : "Risque Élevé"}</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">{lang === "ar" ? "خطر متوسط" : "Risque Moyen"}</Badge>;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <UserX className="h-5 w-5 text-red-500" />
          {lang === "ar" ? "المرضى المعرضون لخطر الانقطاع" : "Patients à risque de désabonnement"}
        </CardTitle>
        <CardDescription>
          {lang === "ar" 
            ? "المرضى الذين يرجح عدم عودتهم للعيادة بناءً على سلوكهم التاريخي" 
            : "Patients susceptibles de ne pas revenir à la clinique selon leur historique"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-md border border-green-100 justify-center">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              {lang === "ar" ? "لا يوجد مرضى معرضون لخطر الانقطاع حالياً." : "Aucun patient à risque identifié actuellement."}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {patients.map((patient) => (
              <div key={patient.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border bg-card">
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{patient.name}</h4>
                    {getRiskBadge(patient.prediction!.riskLevel)}
                  </div>
                  
                  <div className="text-xs text-muted-foreground grid grid-cols-2 gap-y-1">
                    <span>{lang === "ar" ? "آخر زيارة:" : "Dernière visite :"} {Math.floor(patient.features.daysSinceLastVisit)} {lang === "ar" ? "يوماً" : "jours"}</span>
                    <span>{lang === "ar" ? "إجمالي الزيارات:" : "Total visites :"} {patient.features.totalVisits}</span>
                    <span>{lang === "ar" ? "معدل الإلغاء:" : "Taux d'annulation :"} {Math.round(patient.features.cancellationRate * 100)}%</span>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === "ar" ? "عوامل الخطر الرئيسية:" : "Facteurs de risque :"}
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                      {patient.prediction!.keyRiskFactors.map((rf, i) => (
                        <li key={i}>{rf[lang]}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:w-48 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md justify-center">
                  <p className="text-xs font-medium text-center text-slate-600 dark:text-slate-400">
                    {lang === "ar" ? "الإجراء الموصى به" : "Action recommandée"}
                  </p>
                  <p className="text-xs text-center mb-2 line-clamp-2" title={patient.prediction!.suggestedAction[lang]}>
                    {patient.prediction!.suggestedAction[lang]}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <Button size="sm" variant="outline" className="w-full text-xs h-8 px-0" title="Appeler">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" className="w-full text-xs h-8 px-0 bg-[#25D366] hover:bg-[#128C7E]" title="WhatsApp">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
