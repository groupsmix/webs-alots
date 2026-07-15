"use client";

import {
  Clock,
  AlertTriangle,
  User,
  ChevronRight,
  RefreshCw,
  Stethoscope,
  CalendarCheck,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MicroDashboardData {
  nextPatient: {
    id: string;
    name: string;
    phone: string | null;
    appointmentTime: string;
    isFirstVisit: boolean;
    isEmergency: boolean;
    notes: string | null;
    pastVisitCount: number;
    lastVisitDate: string | null;
  } | null;
  remainingCount: number;
  completedToday: number;
  urgentAlert: {
    type: string;
    message: string;
  } | null;
  timestamp: string;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  return `${h}:${m}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-MA", { day: "numeric", month: "short", year: "numeric" });
}

export function MicroDashboardView() {
  const [locale] = useLocale();
  const [data, setData] = useState<MicroDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/doctor/micro-dashboard");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.error ?? "Failed to load");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        void fetchData();
      }, 0),
    );

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => void fetchData(), 60_000);

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      (() => clearInterval(interval))();
    };
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">
            {locale === "ar" ? "جاري التحميل..." : "Chargement..."}
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="text-destructive mx-auto mb-3 h-8 w-8" />
            <p className="text-sm">{error}</p>
            <Button onClick={() => void fetchData()} className="mt-4" size="sm" variant="outline">
              <RefreshCw className="me-2 h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Micro-Dashboard</h1>
          <p className="text-muted-foreground text-xs">
            {data.completedToday} consultations terminées · {data.remainingCount} restantes
          </p>
        </div>
        <Button onClick={() => void fetchData()} size="sm" variant="ghost" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Urgent Alert */}
      {data.urgentAlert && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
            <p className="text-destructive text-sm font-medium">{data.urgentAlert.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Next Patient */}
      {data.nextPatient ? (
        <Card className="border-[var(--oltigo-green)]/30 bg-[var(--oltigo-green)]/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-5 w-5 text-[var(--oltigo-green)]" />
              Patient suivant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                  <User className="text-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{data.nextPatient.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(data.nextPatient.appointmentTime)}
                    {data.nextPatient.phone && (
                      <>
                        <Phone className="ms-1 h-3 w-3" />
                        {data.nextPatient.phone}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {data.nextPatient.isFirstVisit && (
                  <Badge variant="outline" className="text-xs">
                    1ère visite
                  </Badge>
                )}
                {data.nextPatient.isEmergency && (
                  <Badge variant="destructive" className="text-xs">
                    Urgence
                  </Badge>
                )}
              </div>
            </div>

            {/* History highlight */}
            <div className="bg-muted/50 rounded-md p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Visites précédentes:</span>
                <span className="font-medium">{data.nextPatient.pastVisitCount}</span>
              </div>
              {data.nextPatient.lastVisitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dernière visite:</span>
                  <span className="font-medium">{formatDate(data.nextPatient.lastVisitDate)}</span>
                </div>
              )}
              {data.nextPatient.notes && (
                <div className="mt-1 border-t pt-1">
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="mt-0.5 font-medium">
                    {data.nextPatient.notes.length > 120
                      ? data.nextPatient.notes.slice(0, 120) + "…"
                      : data.nextPatient.notes}
                  </p>
                </div>
              )}
            </div>

            <Link href={`/doctor/patients/${data.nextPatient.id}/timeline`}>
              <Button size="sm" variant="outline" className="w-full">
                Voir le dossier patient
                <ChevronRight className="ms-1 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <CalendarCheck className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              Plus de patients prévus pour aujourd&apos;hui
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/doctor/dashboard">
          <Button variant="outline" className="w-full text-sm" size="sm">
            Dashboard complet
          </Button>
        </Link>
        <Link href="/doctor/waiting-room">
          <Button variant="outline" className="w-full text-sm" size="sm">
            Salle d&apos;attente
          </Button>
        </Link>
      </div>
    </div>
  );
}
