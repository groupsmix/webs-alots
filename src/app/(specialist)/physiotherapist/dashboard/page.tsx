"use client";

import { Dumbbell, Users, ClipboardList, Camera, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchPhysioSessions, fetchExercisePrograms, fetchProgressPhotos } from "@/lib/data/client";
import { t } from "@/lib/i18n";
import type { PhysioSession, ExerciseProgram, ProgressPhoto } from "@/lib/types/para-medical";

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

export default function PhysiotherapistDashboardPage() {
  const tenant = useTenant();
  const [locale] = useLocale();
  const [sessions, setSessions] = useState<PhysioSession[]>([]);
  const [programs, setPrograms] = useState<ExerciseProgram[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([fetchPhysioSessions(cId), fetchExercisePrograms(cId), fetchProgressPhotos(cId)])
      .then(([sess, progs, phts]) => {
        if (!controller.signal.aborted) {
          setSessions(sess);
          setPrograms(progs);
          setPhotos(phts);
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

  const activePrograms = programs.filter((p) => p.status === "active");
  const activePatients = new Set(activePrograms.map((p) => p.patient_id)).size;
  const sessionsThisWeek = sessions.filter((s) => withinDays(s.session_date, 7)).length;

  const stats = [
    {
      icon: Users,
      label: t(locale, "spec.dash.activePatients"),
      value: activePatients,
      color: "text-blue-600",
    },
    {
      icon: Dumbbell,
      label: t(locale, "spec.physio.exercisePrograms"),
      value: activePrograms.length,
      color: "text-green-600",
    },
    {
      icon: ClipboardList,
      label: t(locale, "spec.dash.sessionsThisWeek"),
      value: sessionsThisWeek,
      color: "text-orange-600",
    },
    {
      icon: Camera,
      label: t(locale, "spec.physio.progressPhotos"),
      value: photos.length,
      color: "text-purple-600",
    },
  ];

  const recentSessions = [...sessions]
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "spec.physio.title")}</h1>
        </div>
        <Link href="/physiotherapist/sessions" className="shrink-0">
          <Button size="lg">
            <ClipboardList className="h-4 w-4 me-2" />
            {t(locale, "spec.physio.viewSessions")}
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
              {t(locale, "spec.dash.recentSessions")}
            </CardTitle>
            <Link href="/physiotherapist/sessions" className="text-sm text-primary hover:underline">
              {t(locale, "spec.dash.viewAll")}
            </Link>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "spec.dash.noSessions")}</p>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{s.session_date}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t(locale, "spec.physio.minutes", { n: s.duration_minutes })}
                    </span>
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
              {t(locale, "spec.physio.activePrograms")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePrograms.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "spec.physio.noPrograms")}</p>
            ) : (
              <div className="space-y-3">
                {activePrograms.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.patient_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.frequency}</span>
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
