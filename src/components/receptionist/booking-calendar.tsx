"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, User, Clock, GripVertical, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  fetchAppointments,
  fetchDoctors,
  type AppointmentView,
  type DoctorView,
} from "@/lib/data/client";
import { clinicConfig } from "@/config/clinic.config";
import { ManualBookingDialog } from "./manual-booking-dialog";
import { WalkInDialog } from "./walk-in-dialog";

// Local appointment type that supports drag-and-drop rescheduling
interface LocalAppointment extends AppointmentView {
  status: string;
}

export function ReceptionistBookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [localAppointments, setLocalAppointments] = useState<LocalAppointment[]>([]);
  const [doctorList, setDoctorList] = useState<DoctorView[]>([]);
  const [draggedAppointment, setDraggedAppointment] = useState<LocalAppointment | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user?.clinic_id) { setLoading(false); return; }
      const [appts, docs] = await Promise.all([
        fetchAppointments(user.clinic_id),
        fetchDoctors(user.clinic_id),
      ]);
      setLocalAppointments(appts);
      setDoctorList(docs);
      setLoading(false);
    }
    load();
  }, []);

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
    ? localAppointments
    : localAppointments.filter((a) => a.doctorId === selectedDoctor);

  const getAppointmentForSlot = (date: Date, time: string) => {
    const dateStr = date.toISOString().split("T")[0];
    return filteredAppointments.find((a) => a.date === dateStr && a.time === time);
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    confirmed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    "in-progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    "no-show": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    rescheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  const handleDragStart = useCallback((e: React.DragEvent, appointment: LocalAppointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", appointment.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, date: Date, time: string) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedAppointment) return;

    const newDate = date.toISOString().split("T")[0];
    const existingAppt = localAppointments.find(
      (a) => a.date === newDate && a.time === time && a.id !== draggedAppointment.id
    );
    if (existingAppt) return;

    setLocalAppointments((prev) =>
      prev.map((a) =>
        a.id === draggedAppointment.id
          ? { ...a, date: newDate, time, status: "rescheduled" as const }
          : a
      )
    );
    setDraggedAppointment(null);
  }, [draggedAppointment, localAppointments]);

  const handleNewBooking = (booking: {
    patientId: string;
    doctorId: string;
    serviceId: string;
    date: string;
    time: string;
    notes: string;
    source: "phone" | "walk_in";
  }) => {
    const doctor = doctorList.find((d) => d.id === booking.doctorId);
    const newAppointment: LocalAppointment = {
      id: `a${Date.now()}`,
      patientId: booking.patientId,
      patientName: "New Patient",
      doctorId: booking.doctorId,
      doctorName: doctor?.name ?? "",
      serviceId: booking.serviceId,
      serviceName: "Consultation",
      date: booking.date,
      time: booking.time,
      status: "scheduled",
      isFirstVisit: false,
      hasInsurance: false,
    };
    setLocalAppointments((prev) => [...prev, newAppointment]);
  };

  const handleCallPatient = (phone: string) => {
    window.open(`tel:${phone.replace(/\s/g, "")}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\s/g, "").replace("+", "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

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
            {doctorList.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
          <ManualBookingDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Booking
              </Button>
            }
            onBook={handleNewBooking}
          />
          <WalkInDialog
            trigger={
              <Button size="sm" variant="outline">
                <User className="h-4 w-4 mr-1" />
                Walk-in
              </Button>
            }
          />
        </div>
      </div>

      {/* Drag-and-drop hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <GripVertical className="h-3 w-3" />
        <span>Drag and drop appointments to reschedule them. Click on an appointment for details.</span>
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
                    const cellId = `${dateStr}-${time}`;
                    const isDragOver = dragOverCell === cellId;

                    return (
                      <td
                        key={i}
                        className={`p-1 align-top transition-colors ${isToday ? "bg-primary/5" : ""} ${!wh.enabled ? "bg-muted/30" : ""} ${isDragOver ? "bg-primary/20 ring-2 ring-primary/30 ring-inset" : ""}`}
                        onDragOver={wh.enabled ? (e) => handleDragOver(e, cellId) : undefined}
                        onDragLeave={handleDragLeave}
                        onDrop={wh.enabled ? (e) => handleDrop(e, date, time) : undefined}
                      >
                        {wh.enabled && (
                          appt ? (
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, appt)}
                              className={`text-[10px] rounded p-1.5 cursor-grab active:cursor-grabbing ${statusColors[appt.status] ?? "bg-muted"} group relative`}
                            >
                              <div className="flex items-center gap-1">
                                <GripVertical className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                                <User className="h-2.5 w-2.5" />
                                <span className="font-medium truncate">{appt.patientName}</span>
                              </div>
                              <div className="truncate mt-0.5">{appt.serviceName}</div>
                              {/* Quick action buttons on hover */}
                              <div className="absolute top-0 right-0 hidden group-hover:flex gap-0.5 p-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCallPatient("+212612345678"); }}
                                  className="p-0.5 rounded bg-white/80 hover:bg-white shadow-sm"
                                  title="Call patient"
                                >
                                  <Phone className="h-2.5 w-2.5 text-blue-600" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleWhatsApp("+212612345678"); }}
                                  className="p-0.5 rounded bg-white/80 hover:bg-white shadow-sm"
                                  title="WhatsApp patient"
                                >
                                  <MessageCircle className="h-2.5 w-2.5 text-green-600" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`h-8 rounded border border-dashed transition-colors ${
                                isDragOver
                                  ? "border-primary bg-primary/10"
                                  : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5"
                              } cursor-pointer`}
                            />
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
