"use client";

import { Calendar, Clock, User, MapPin, X, RefreshCw, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { isCancellableStatus } from "@/lib/booking-utils";
import {
  getCurrentUser,
  fetchPatientAppointments,
  type AppointmentView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { AppointmentStatus } from "@/lib/types/database";
import { formatDisplayDate } from "@/lib/utils";
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
 * Server-validated cancellation check.
 *
 * Delegates to the server endpoint which uses the clinic's configured
 * timezone (from the DB) to compute the cancellation window. This avoids
 * the bug where the client's local timezone or a hardcoded default
 * timezone produces incorrect results for clinics outside Africa/Casablanca
 * or during Morocco's complex DST transitions.
 */
async function checkCanCancel(
  appointmentId: string,
): Promise<{ canCancel: boolean; reason?: string }> {
  try {
    const res = await fetch(`/api/booking/cancel?appointmentId=${encodeURIComponent(appointmentId)}`);
    if (!res.ok) {
      return { canCancel: false, reason: "Unable to verify cancellation eligibility" };
    }
    const data = await res.json();
    return { canCancel: data.canCancel, reason: data.reason };
  } catch (err) {
    logger.warn("Failed to check cancellation eligibility", { context: "appointment-list", appointmentId, error: err });
    return { canCancel: false, reason: "Unable to verify cancellation eligibility" };
  }
}

/**
 * AppointmentList
 *
 * Shows upcoming and past appointments for a patient.
 * Supports cancel and reschedule actions.
 */
export function AppointmentList({ patientId }: { patientId?: string }) {
  const [allAppts, setAllAppts] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rescheduleAppt, setRescheduleAppt] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const pid = patientId ?? user.id;
    const appts = await fetchPatientAppointments(user.clinic_id, pid);
      if (controller.signal.aborted) return;
    setAllAppts(appts);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, [patientId, refreshKey]);

  const upcoming = allAppts.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed" || a.status === "in-progress",
  );
  const past = allAppts.filter(
    (a) => a.status === "completed" || a.status === "cancelled" || a.status === "no-show" || a.status === "rescheduled",
  );

  const handleCancel = async (appointmentId: string) => {
    setCancelError(null);
    const appt = allAppts.find((a) => a.id === appointmentId);
    if (!appt) {
      setCancelError("Appointment not found");
      return;
    }
    // Quick client-side status check (no network call)
    if (!isCancellableStatus(appt.status as AppointmentStatus)) {
      setCancelError("Appointment cannot be cancelled in its current state");
      return;
    }
    // Server-validated timezone-aware cancellation window check
    const check = await checkCanCancel(appointmentId);
    if (!check.canCancel) {
      setCancelError(check.reason ?? "Cannot cancel this appointment");
      return;
    }

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
    } catch (err) {
      logger.warn("Failed to cancel appointment", { context: "appointment-list", error: err });
      const message = err instanceof Error ? err.message : "An error occurred";
      setCancelError(message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <PageLoader message="Loading appointments..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  const apptToReschedule = rescheduleAppt
    ? allAppts.find((a) => a.id === rescheduleAppt)
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
                        {appt.notes && (
                          <Badge variant="outline" className="text-xs">
                            {appt.notes}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDisplayDate(appt.date, "fr", "long")}
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
                    {formatDisplayDate(appt.date, "fr", "short")} - {appt.doctorName}
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
