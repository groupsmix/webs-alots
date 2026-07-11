"use client";

import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Clock,
  ListOrdered,
  TrendingUp,
  UserX,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/data/client";

interface WaitlistEntry {
  id: string;
  patient_id: string;
  doctor_id: string;
  preferred_date: string | null;
  preferred_time: string | null;
  urgency: string | null;
  priority_score: number | null;
  status: string | null;
  created_at: string | null;
}

interface NoShowAlert {
  id: string;
  patient_id: string;
  appointment_date: string;
  slot_start: string;
  patient_name: string;
  status: string;
}

interface ReminderSummary {
  pending24h: number;
  pending2h: number;
  sentToday: number;
  failedToday: number;
}

interface ReceptionistAIWidgetProps {
  clinicId: string;
}

export function ReceptionistAIWidget({ clinicId }: ReceptionistAIWidgetProps) {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [noShowAlerts, setNoShowAlerts] = useState<NoShowAlert[]>([]);
  const [reminderSummary, setReminderSummary] = useState<ReminderSummary>({
    pending24h: 0,
    pending2h: 0,
    sentToday: 0,
    failedToday: 0,
  });
  const [flaggedPatientCount, setFlaggedPatientCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"schedule" | "waitlist" | "noshow" | "reminders">(
    "schedule",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      // Fetch waitlist entries sorted by priority
      const { data: waitlist } = await supabase
        .from("waiting_list")
        .select(
          "id, patient_id, doctor_id, preferred_date, preferred_time, urgency, priority_score, status, created_at",
        )
        .eq("clinic_id", clinicId)
        .eq("status", "waiting")
        .order("priority_score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(10);

      if (cancelled) return;
      setWaitlistEntries(waitlist ?? []);

      // Fetch today's no-show-eligible appointments (past slot_start, still scheduled/confirmed)
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const { data: potentialNoShows } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_date, slot_start, status")
        .eq("clinic_id", clinicId)
        .eq("appointment_date", today)
        .in("status", ["scheduled", "confirmed"])
        .lt("slot_start", currentTime)
        .limit(10);

      if (cancelled) return;

      if (potentialNoShows) {
        const patientIds = [...new Set(potentialNoShows.map((a) => a.patient_id))];
        const { data: patients } = await supabase
          .from("users")
          .select("id, name")
          .eq("clinic_id", clinicId)
          .in("id", patientIds);

        const nameMap = new Map((patients ?? []).map((p) => [p.id, p.name]));

        if (!cancelled) {
          setNoShowAlerts(
            potentialNoShows.map((a) => ({
              id: a.id,
              patient_id: a.patient_id,
              appointment_date: a.appointment_date ?? "",
              slot_start: a.slot_start,
              patient_name: nameMap.get(a.patient_id) ?? "Inconnu",
              status: a.status,
            })),
          );
        }
      }

      // Fetch reminder summary
      const [
        { count: pending24h },
        { count: pending2h },
        { count: sentToday },
        { count: failedToday },
      ] = await Promise.all([
        supabase
          .from("appointment_reminders")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("reminder_type", "24h")
          .eq("status", "pending"),
        supabase
          .from("appointment_reminders")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("reminder_type", "2h")
          .eq("status", "pending"),
        supabase
          .from("appointment_reminders")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "sent")
          .gte("sent_at", `${today}T00:00:00`),
        supabase
          .from("appointment_reminders")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "failed")
          .gte("created_at", `${today}T00:00:00`),
      ]);

      if (cancelled) return;

      setReminderSummary({
        pending24h: pending24h ?? 0,
        pending2h: pending2h ?? 0,
        sentToday: sentToday ?? 0,
        failedToday: failedToday ?? 0,
      });

      // Fetch flagged patient count
      const { count: flagged } = await supabase
        .from("no_show_stats")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("is_flagged", true);

      if (!cancelled) {
        setFlaggedPatientCount(flagged ?? 0);
      }
    }

    loadData();

    // Subscribe to realtime changes
    const supabase = createClient();

    const channel = supabase
      .channel("receptionist-ai-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          loadData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waiting_list",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          loadData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_reminders",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          loadData();
        },
      )
      .subscribe();

    // Refresh every 60 seconds
    const interval = setInterval(loadData, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [clinicId]);

  const urgencyColor: Record<string, string> = {
    low: "text-gray-500",
    normal: "text-blue-600",
    high: "text-orange-600",
    urgent: "text-red-600",
  };

  const urgencyBadge: Record<string, "default" | "secondary" | "warning" | "destructive"> = {
    low: "secondary",
    normal: "default",
    high: "warning",
    urgent: "destructive",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          IA Réceptionniste
        </CardTitle>
        <div className="flex gap-1 mt-2">
          <Button
            variant={activeTab === "schedule" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveTab("schedule")}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Aperçu
          </Button>
          <Button
            variant={activeTab === "waitlist" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveTab("waitlist")}
          >
            <ListOrdered className="h-3 w-3 mr-1" />
            Liste d&apos;attente
            {waitlistEntries.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-[10px]">
                {waitlistEntries.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "noshow" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveTab("noshow")}
          >
            <UserX className="h-3 w-3 mr-1" />
            Absences
            {noShowAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 text-[10px]">
                {noShowAlerts.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === "reminders" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveTab("reminders")}
          >
            <Bell className="h-3 w-3 mr-1" />
            Rappels
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === "schedule" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-2 text-center">
                <p className="text-lg font-bold text-orange-600">{noShowAlerts.length}</p>
                <p className="text-[10px] text-muted-foreground">Absences potentielles</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-lg font-bold text-blue-600">{waitlistEntries.length}</p>
                <p className="text-[10px] text-muted-foreground">File d&apos;attente</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-lg font-bold text-green-600">{reminderSummary.sentToday}</p>
                <p className="text-[10px] text-muted-foreground">Rappels envoyés</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-lg font-bold text-red-600">{flaggedPatientCount}</p>
                <p className="text-[10px] text-muted-foreground">Patients signalés</p>
              </div>
            </div>
            {reminderSummary.pending24h + reminderSummary.pending2h > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2">
                <p className="text-xs font-medium text-yellow-800 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {reminderSummary.pending24h + reminderSummary.pending2h} rappels en attente
                  d&apos;envoi
                </p>
              </div>
            )}
            {reminderSummary.failedToday > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-medium text-red-800 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {reminderSummary.failedToday} rappels échoués aujourd&apos;hui
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "waitlist" && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {waitlistEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun patient en liste d&apos;attente.
              </p>
            ) : (
              waitlistEntries.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {entry.preferred_date}
                      {entry.preferred_time ? ` à ${entry.preferred_time}` : ""}
                    </p>
                  </div>
                  <Badge variant={urgencyBadge[entry.urgency ?? "normal"]} className="text-[10px]">
                    {entry.urgency ?? "normal"}
                  </Badge>
                  <span
                    className={`text-[10px] font-medium ${urgencyColor[entry.urgency ?? "normal"]}`}
                  >
                    P{entry.priority_score ?? 0}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "noshow" && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {noShowAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune absence potentielle détectée.</p>
            ) : (
              noShowAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-2"
                >
                  <UserX className="h-4 w-4 text-orange-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.patient_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Prévu à {alert.slot_start} &mdash; non arrivé
                    </p>
                  </div>
                  <Badge variant="warning" className="text-[10px] shrink-0">
                    {alert.status}
                  </Badge>
                </div>
              ))
            )}
            {flaggedPatientCount > 0 && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                <p className="text-xs text-red-800 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {flaggedPatientCount} patient(s) signalé(s) comme récidivistes
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "reminders" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">Rappels 24h</p>
                <p className="text-lg font-bold">{reminderSummary.pending24h}</p>
                <p className="text-[10px] text-muted-foreground">en attente</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">Rappels 2h</p>
                <p className="text-lg font-bold">{reminderSummary.pending2h}</p>
                <p className="text-[10px] text-muted-foreground">en attente</p>
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Envoyés aujourd&apos;hui</span>
                <span className="font-medium text-green-600">{reminderSummary.sentToday}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">Échoués aujourd&apos;hui</span>
                <span className="font-medium text-red-600">{reminderSummary.failedToday}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
