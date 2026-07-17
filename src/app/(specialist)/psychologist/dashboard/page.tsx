"use client";

import { Brain, Users, Target, TrendingUp, Calendar, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchTherapySessionNotes, fetchTherapyPlans } from "@/lib/data/client";
import { t } from "@/lib/i18n";
import type { TherapySessionNote, TherapyPlan } from "@/lib/types/para-medical";

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

export default function PsychologistDashboardPage() {
  const tenant = useTenant();
  const [locale] = useLocale();
  const [notes, setNotes] = useState<TherapySessionNote[]>([]);
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchTherapySessionNotes(cId), fetchTherapyPlans(cId)])
      .then(([n, p]) => {
        if (!controller.signal.aborted) {
          setNotes(n);
          setPlans(p);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e as Error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [tenant?.clinicId]);

  if (loading) {
    return <PageLoader message={t(locale, "spec.dash.loading")} />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{t(locale, "spec.dash.loadError")}</p>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.status === "active");
  const activePatients = new Set(activePlans.map((p) => p.patient_id)).size;
  const sessionsThisWeek = notes.filter((n) => withinDays(n.session_date, 7)).length;
  const highRiskPatients = new Set(
    notes.filter((n) => n.risk_assessment === "high").map((n) => n.patient_id),
  ).size;

  const stats = [
    {
      icon: Users,
      label: t(locale, "spec.dash.activePatients"),
      value: activePatients,
      color: "text-blue-600",
    },
    {
      icon: Brain,
      label: t(locale, "spec.dash.sessionsThisWeek"),
      value: sessionsThisWeek,
      color: "text-purple-600",
    },
    {
      icon: Target,
      label: t(locale, "spec.psy.activeTherapyPlans"),
      value: activePlans.length,
      color: "text-green-600",
    },
    {
      icon: Shield,
      label: t(locale, "spec.psy.highRiskPatients"),
      value: highRiskPatients,
      color: "text-red-500",
    },
  ];

  const recentNotes = [...notes]
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "spec.psy.title")}</h1>
        </div>
        <Link href="/psychologist/session-notes" className="shrink-0">
          <Button size="lg">
            <Brain className="h-4 w-4 me-2" />
            {t(locale, "spec.psy.viewNotes")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t(locale, "spec.psy.recentNotes")}
            </CardTitle>
            <Link
              href="/psychologist/session-notes"
              className="text-sm text-primary hover:underline"
            >
              {t(locale, "spec.dash.viewAll")}
            </Link>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "spec.psy.noNotes")}</p>
            ) : (
              <div className="space-y-3">
                {recentNotes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{n.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{n.session_date}</p>
                    </div>
                    {n.risk_assessment === "high" && (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        {t(locale, "spec.psy.highRisk")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t(locale, "spec.psy.activeTherapyPlans")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "spec.psy.noPlans")}</p>
            ) : (
              <div className="space-y-3">
                {activePlans.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.patient_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.treatment_approach}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t(locale, "spec.psy.goals", { n: p.goals.length })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
