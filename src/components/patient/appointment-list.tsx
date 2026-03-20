"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, User, MapPin, X, RefreshCw, AlertTriangle, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  fetchAppointments,
  type AppointmentView,
} from "@/lib/data/client";
import { RescheduleDialog } from "./reschedule-dialog";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "default",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
  rescheduled: "outline",
  "no-show": "outline",
  "in-progress": "default",
};

/**
 * AppointmentList
 *
 * Shows upcoming and past appointments for a patient.
 * Supports cancel and reschedule actions.
 */
export function AppointmentList({ patientId }: { patientId?: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [rescheduleAppt, setRescheduleAppt] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [allAppointments, setAllAppointments] = useState<AppointmentView[]>([]);

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const data = await fetchAppointments(user.clinic_id);
    setAllAppointments(data);
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const patientAppts = patientId
    ? allAppointments.filter((a) => a.patientId === patientId)
    : allAppointments.slice(0, 4);

  const upcoming = patientAppts.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed" || a.status === "in-progress",
  );
  const past = patientAppts.filter(
    (a) => a.status === "completed" || a.status === "cancelled" || a.status === "no-show" || a.status === "rescheduled",
  );

  const handleCancel = async (appointmentId: string) => {
    setCancelError(null);
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

      setRefreshKey((k) => k + 1);
    } catch {
      setCancelError("An error occurred");
    } finally {
      setCancellingId(null);
    }
  };

  const apptToReschedule = rescheduleAppt
    ? allAppointments.find((a) => a.id === rescheduleAppt)
    : null;

  if (apptToReschedule) {
    return (
      <RescheduleDialog
        appointment={apptToReschedule}
        onClose={() => setRescheduleAppt(null)}
        onReschedule={() => {
          setRescheduleAppt(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Upcoming Appointments
        </h3>

        {cancelError && (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {cancelError}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCancelError(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <Card key={appt.id} className={`border-l-4 ${appt.isEmergency ? "border-l-orange-500" : "border-l-primary"}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
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
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {appt.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appt.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {appt.doctorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Room 1
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusVariant[appt.status] ?? "default"}>
                      {appt.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRescheduleAppt(appt.id)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleCancel(appt.id)}
                      disabled={cancellingId === appt.id}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {cancellingId === appt.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
              <Button variant="link" size="sm" className="mt-2">
                Book an appointment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Past Appointments
        </h3>
        {past.length > 0 ? (
          <div className="space-y-2">
            {past.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{appt.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {appt.date} - {appt.doctorName}
                  </p>
                  {appt.cancellationReason && (
                    <p className="text-xs text-destructive mt-1">
                      Reason: {appt.cancellationReason}
                    </p>
                  )}
                </div>
                <Badge variant={statusVariant[appt.status] ?? "secondary"}>
                  {appt.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No past appointments.</p>
        )}
      </div>
    </div>
  );
}
