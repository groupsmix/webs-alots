"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clinicConfig } from "@/config/clinic.config";
import {
  getCurrentUser,
  fetchDoctorAppointments,
  type AppointmentView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { MarkUnavailableDialog } from "@/components/doctor/mark-unavailable-dialog";
import { RebookingStatus } from "@/components/doctor/rebooking-status";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  scheduled: "outline",
  confirmed: "default",
  "in-progress": "warning",
  completed: "success",
  "no-show": "destructive",
  cancelled: "secondary",
};

export default function DoctorSchedulePage() {
  const [doctorAppointments, setDoctorAppointments] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userId, setUserId] = useState("");
  const [clinicId, setClinicId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    setUserId(user.id);
    setClinicId(user.clinic_id);
    const appts = await fetchDoctorAppointments(user.clinic_id, user.id);
      if (controller.signal.aborted) return;
    setDoctorAppointments(appts);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading schedule..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        {clinicId && (
          <MarkUnavailableDialog doctorId={userId} clinicId={clinicId} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {doctorAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{apt.patientName}</p>
                    <p className="text-xs text-muted-foreground">{apt.serviceName}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-sm">{apt.date}</p>
                      <p className="text-xs text-muted-foreground">{apt.time}</p>
                    </div>
                    <Badge variant={statusVariant[apt.status]}>{apt.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Working Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dayNames.map((day, i) => {
                  const wh = clinicConfig.workingHours[i];
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Schedule" }]} />
                      <span className={wh.enabled ? "" : "text-muted-foreground"}>{day}</span>
                      {wh.enabled ? (
                        <span className="font-medium">{wh.open} - {wh.close}</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Closed</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Rebooking Status (Feature 16.7) */}
          {clinicId && userId && (
            <RebookingStatus clinicId={clinicId} doctorId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}
