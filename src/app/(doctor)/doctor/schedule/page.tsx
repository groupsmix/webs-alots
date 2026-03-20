"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clinicConfig } from "@/config/clinic.config";
import {
  getCurrentUser,
  fetchDoctorAppointments,
  type AppointmentView,
} from "@/lib/data/client";

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

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const appts = await fetchDoctorAppointments(user.clinic_id, user.id);
    setDoctorAppointments(appts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Schedule</h1>

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
      </div>
    </div>
  );
}
