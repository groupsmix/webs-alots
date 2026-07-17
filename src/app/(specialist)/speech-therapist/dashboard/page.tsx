"use client";

import { Mic, Users, BookOpen, FileText, Calendar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  fetchSpeechSessions,
  fetchSpeechExercises,
  fetchSpeechProgressReports,
} from "@/lib/data/client";
import type { SpeechSession, SpeechExercise, SpeechProgressReport } from "@/lib/types/para-medical";

const PRIMARY_ACTION_LABEL = "View sessions";

function withinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d <= days * 24 * 60 * 60 * 1000;
}

export default function SpeechTherapistDashboardPage() {
  const tenant = useTenant();
  const [sessions, setSessions] = useState<SpeechSession[]>([]);
  const [exercises, setExercises] = useState<SpeechExercise[]>([]);
  const [reports, setReports] = useState<SpeechProgressReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cId = tenant?.clinicId ?? "";
    Promise.all([
      fetchSpeechSessions(cId),
      fetchSpeechExercises(cId),
      fetchSpeechProgressReports(cId),
    ])
      .then(([sess, ex, rep]) => {
        if (!controller.signal.aborted) {
          setSessions(sess);
          setExercises(ex);
          setReports(rep);
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
    return <PageLoader message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const activePatients = new Set(
    sessions.filter((s) => withinDays(s.session_date, 30)).map((s) => s.patient_id),
  ).size;
  const sessionsThisWeek = sessions.filter((s) => withinDays(s.session_date, 7)).length;

  const stats = [
    { icon: Users, label: "Active Patients", value: activePatients, color: "text-blue-600" },
    { icon: Mic, label: "Sessions This Week", value: sessionsThisWeek, color: "text-teal-600" },
    {
      icon: BookOpen,
      label: "Exercises in Library",
      value: exercises.length,
      color: "text-green-600",
    },
    { icon: FileText, label: "Progress Reports", value: reports.length, color: "text-purple-600" },
  ];

  const recentSessions = [...sessions]
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
    .slice(0, 5);
  const recentReports = [...reports]
    .sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Speech Therapist Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Orthophoniste — أخصائي نطق</p>
        </div>
        <Link href="/speech-therapist/sessions" className="shrink-0">
          <Button size="lg">
            <Mic className="h-4 w-4 me-2" />
            {PRIMARY_ACTION_LABEL}
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
              Recent Sessions
            </CardTitle>
            <Link
              href="/speech-therapist/sessions"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
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
                      {s.accuracy_pct != null ? `${s.accuracy_pct}%` : `${s.duration_minutes} min`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Progress Reports
            </CardTitle>
            <Link href="/speech-therapist/reports" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No progress reports yet.</p>
            ) : (
              <div className="space-y-3">
                {recentReports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{r.report_date}</p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {r.overall_progress}
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
