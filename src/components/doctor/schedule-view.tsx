"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, User, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  fetchAppointments,
  type AppointmentView,
} from "@/lib/data/client";
import { clinicConfig } from "@/config/clinic.config";
import { EmergencySlotCreator } from "./emergency-slot-creator";

type ViewMode = "timeline" | "list";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "in-progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "no-show": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

/**
 * ScheduleView
 *
 * Doctor's daily schedule with appointment timeline,
 * waiting room view, and mark-as-done controls.
 */
export function ScheduleView() {
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [todayAppointments, setTodayAppointments] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const appts = await fetchAppointments(user.clinic_id);
    const today = new Date().toISOString().split("T")[0];
    const filtered = appts.filter((a) => a.date === today);
    setTodayAppointments(filtered.length > 0 ? filtered : appts.slice(0, 6));
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Today&apos;s Schedule</h3>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "timeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("timeline")}
          >
            Timeline
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
        </div>
      </div>

      {viewMode === "timeline" ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              {timeSlots.map((slot) => {
                const appt = todayAppointments.find((a) => a.time === slot);
                return (
                  <div key={slot} className="flex items-stretch gap-3 min-h-[48px]">
                    <div className="w-14 text-xs text-muted-foreground flex items-center justify-end pr-2 border-r">
                      {slot}
                    </div>
                    {appt ? (
                      <div className="flex-1 rounded-lg border p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{appt.patientName}</p>
                            <p className="text-xs text-muted-foreground">{appt.serviceName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[appt.status] ?? ""}`}>
                            {appt.status}
                          </span>
                          {appt.status === "scheduled" && (
                            <Button variant="ghost" size="sm" title="Start consultation">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {appt.status === "in-progress" && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" title="Mark as done">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Cancel">
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 rounded-lg border border-dashed p-3 flex items-center">
                        <p className="text-xs text-muted-foreground">Available</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {todayAppointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{appt.patientName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {appt.time} - {appt.serviceName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{appt.status}</Badge>
                    {appt.status === "scheduled" && (
                      <Button variant="outline" size="sm">Start</Button>
                    )}
                    {appt.status === "in-progress" && (
                      <Button variant="outline" size="sm">Complete</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {clinicConfig.features.emergencySlots && (
        <EmergencySlotCreator doctorId="d1" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waiting Room</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {todayAppointments.filter((a) => a.status === "scheduled").length}
              </p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {todayAppointments.filter((a) => a.status === "in-progress").length}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {todayAppointments.filter((a) => a.status === "completed").length}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
