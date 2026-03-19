"use client";

import { Calendar, Clock, User, MapPin, X, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appointments } from "@/lib/demo-data";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "default",
  completed: "secondary",
  cancelled: "destructive",
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
  const patientAppts = patientId
    ? appointments.filter((a) => a.patientId === patientId)
    : appointments.slice(0, 4);

  const upcoming = patientAppts.filter((a) => a.status === "scheduled" || a.status === "in-progress");
  const past = patientAppts.filter((a) => a.status === "completed" || a.status === "cancelled" || a.status === "no-show");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Upcoming Appointments
        </h3>
        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <Card key={appt.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="font-medium">{appt.serviceName}</p>
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
                          Dr. {appt.doctorName}
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
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reschedule
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <X className="h-3 w-3 mr-1" />
                      Cancel
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
                    {appt.date} - Dr. {appt.doctorName}
                  </p>
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
