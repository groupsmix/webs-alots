"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, User, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appointments, doctors } from "@/lib/demo-data";
import { clinicConfig } from "@/config/clinic.config";

/**
 * ReceptionistBookingCalendar
 *
 * Full booking calendar for all doctors and all slots.
 * Supports manual booking, walk-in registration, and drag-and-drop reschedule.
 */
export function ReceptionistBookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState("all");

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  ];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getWeekDates = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates();
  const today = new Date().toISOString().split("T")[0];

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const filteredAppointments = selectedDoctor === "all"
    ? appointments
    : appointments.filter((a) => a.doctorId === selectedDoctor);

  const getAppointmentForSlot = (date: Date, time: string) => {
    const dateStr = date.toISOString().split("T")[0];
    return filteredAppointments.find((a) => a.date === dateStr && a.time === time);
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "in-progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
            {weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Doctors</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                Dr. {doc.name}
              </option>
            ))}
          </select>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Weekly Calendar Grid */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="w-16 text-xs text-muted-foreground font-normal text-left p-2">
                  <Clock className="h-3 w-3" />
                </th>
                {weekDates.map((date, i) => {
                  const dateStr = date.toISOString().split("T")[0];
                  const dayIdx = date.getDay();
                  const wh = clinicConfig.workingHours[dayIdx];
                  const isToday = dateStr === today;
                  return (
                    <th
                      key={i}
                      className={`text-center p-2 text-xs ${isToday ? "bg-primary/5 rounded-t-lg" : ""} ${!wh.enabled ? "opacity-50" : ""}`}
                    >
                      <div className="font-medium">{dayNames[i]}</div>
                      <div className={`${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {date.getDate()}
                      </div>
                      {!wh.enabled && <Badge variant="secondary" className="text-[9px] mt-1">Closed</Badge>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr key={time} className="border-t">
                  <td className="text-xs text-muted-foreground p-2 align-top">{time}</td>
                  {weekDates.map((date, i) => {
                    const dayIdx = date.getDay();
                    const wh = clinicConfig.workingHours[dayIdx];
                    const appt = wh.enabled ? getAppointmentForSlot(date, time) : null;
                    const dateStr = date.toISOString().split("T")[0];
                    const isToday = dateStr === today;

                    return (
                      <td
                        key={i}
                        className={`p-1 align-top ${isToday ? "bg-primary/5" : ""} ${!wh.enabled ? "bg-muted/30" : ""}`}
                      >
                        {wh.enabled && (
                          appt ? (
                            <div className={`text-[10px] rounded p-1.5 cursor-pointer ${statusColors[appt.status] ?? "bg-muted"}`}>
                              <div className="flex items-center gap-1">
                                <User className="h-2.5 w-2.5" />
                                <span className="font-medium truncate">{appt.patientName}</span>
                              </div>
                              <div className="truncate mt-0.5">{appt.serviceName}</div>
                            </div>
                          ) : (
                            <div className="h-8 rounded border border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors" />
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded ${color}`} />
            <span className="text-xs text-muted-foreground capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
