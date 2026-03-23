"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, User, MapPin, X, RefreshCw, AlertTriangle, Repeat, Plus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchPatientAppointments,
  type AppointmentView,
} from "@/lib/data/client";
import { RescheduleDialog } from "@/components/patient/reschedule-dialog";
import { PageLoader } from "@/components/ui/page-loader";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  "no-show": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  rescheduled: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function PatientAppointmentsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [refreshKey, setRefreshKey] = useState(0);
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const appts = await fetchPatientAppointments(user.clinic_id, user.id);
      if (controller.signal.aborted) return;
    setPatientAppointments(appts);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, [refreshKey]);

  if (loading) {
    return <PageLoader message="Loading appointments..." />;
  }
  const upcoming = patientAppointments.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed" || a.status === "in-progress"
  );
  const past = patientAppointments.filter(
    (a) => a.status === "completed" || a.status === "no-show" || a.status === "cancelled" || a.status === "rescheduled"
  );

  const displayed = tab === "upcoming" ? upcoming : past;

  const handleCancel = async (appointmentId: string) => {
    setCancelError(null);
    setCancelSuccess(null);

    setCancellingId(appointmentId);
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, reason: "Cancelled by patient" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? "Failed to cancel");
        return;
      }

      setCancelSuccess("Appointment cancelled successfully.");
      setRefreshKey((k) => k + 1);
    } catch {
      setCancelError("An error occurred while cancelling.");
    } finally {
      setCancellingId(null);
    }
  };

  const apptToReschedule = rescheduleApptId
    ? patientAppointments.find((a) => a.id === rescheduleApptId)
    : null;

  if (apptToReschedule) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Reschedule Appointment</h1>
        <RescheduleDialog
          appointment={apptToReschedule}
          onClose={() => setRescheduleApptId(null)}
          onReschedule={() => {
            setRescheduleApptId(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {upcoming.length} upcoming, {past.length} past
          </p>
        </div>
        <Link href="/book">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Book New
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="upcoming" className="mb-6">
        <TabsList>
          <TabsTrigger value="upcoming" onClick={() => setTab("upcoming")}>
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past" onClick={() => setTab("past")}>
            Past ({past.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {cancelError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {cancelError}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCancelError(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {cancelSuccess && (
        <div className="mb-4 rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          {cancelSuccess}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCancelSuccess(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {displayed.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {tab === "upcoming" ? "No upcoming appointments" : "No past appointments"}
            </p>
            {tab === "upcoming" && (
              <Link href="/book">
                <Button variant="link" className="mt-2">Book an appointment</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((appt) => (
            <Card key={appt.id} className={tab === "upcoming" ? "border-l-4 border-l-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{appt.serviceName}</p>
                      {appt.isEmergency && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Emergency
                        </Badge>
                      )}
                      {appt.recurrenceGroupId && (
                        <Badge variant="outline" className="text-xs">
                          <Repeat className="h-3 w-3 mr-1" />
                          {appt.recurrencePattern}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {appt.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {appt.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {appt.doctorName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        Room 1
                      </span>
                    </div>
                    {appt.cancellationReason && (
                      <p className="text-xs text-destructive">
                        Reason: {appt.cancellationReason}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[appt.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {appt.status}
                  </span>
                </div>

                {tab === "upcoming" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRescheduleApptId(appt.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleCancel(appt.id)}
                      disabled={cancellingId === appt.id}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      {cancellingId === appt.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
