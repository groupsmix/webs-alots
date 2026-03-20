"use client";

import { useState, useCallback } from "react";
import {
  User, Clock, ArrowUp, ArrowDown, CheckCircle2, XCircle, Bell,
  UserPlus, Phone, MessageCircle, Timer, Stethoscope
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WalkInDialog } from "./walk-in-dialog";

interface WaitingPatient {
  id: string;
  name: string;
  phone: string;
  arrivalTime: string;
  appointmentTime: string;
  doctor: string;
  service: string;
  status: "waiting" | "in-consultation" | "called";
  priority: number;
  isWalkIn: boolean;
  estimatedWait: number;
}

export function WaitingRoomManager() {
  const [queue, setQueue] = useState<WaitingPatient[]>([
    {
      id: "w1",
      name: "Fatima Zahra",
      phone: "+212 6 12 34 56 78",
      arrivalTime: "09:05",
      appointmentTime: "09:30",
      doctor: "Dr. Ahmed",
      service: "General Consultation",
      status: "in-consultation",
      priority: 1,
      isWalkIn: false,
      estimatedWait: 0,
    },
    {
      id: "w2",
      name: "Mohammed Ali",
      phone: "+212 6 23 45 67 89",
      arrivalTime: "09:15",
      appointmentTime: "10:00",
      doctor: "Dr. Ahmed",
      service: "Follow-up Visit",
      status: "called",
      priority: 2,
      isWalkIn: false,
      estimatedWait: 5,
    },
    {
      id: "w3",
      name: "Khadija Benali",
      phone: "+212 6 33 44 55 66",
      arrivalTime: "09:30",
      appointmentTime: "10:30",
      doctor: "Dr. Ahmed",
      service: "Blood Test",
      status: "waiting",
      priority: 3,
      isWalkIn: false,
      estimatedWait: 20,
    },
    {
      id: "w4",
      name: "Youssef Amrani",
      phone: "+212 6 44 55 66 77",
      arrivalTime: "09:45",
      appointmentTime: "11:00",
      doctor: "Dr. Ahmed",
      service: "General Consultation",
      status: "waiting",
      priority: 4,
      isWalkIn: true,
      estimatedWait: 35,
    },
    {
      id: "w5",
      name: "Amina Tazi",
      phone: "+212 6 55 66 77 88",
      arrivalTime: "10:00",
      appointmentTime: "11:30",
      doctor: "Dr. Ahmed",
      service: "Vaccination",
      status: "waiting",
      priority: 5,
      isWalkIn: false,
      estimatedWait: 50,
    },
  ]);

  const statusConfig: Record<string, { color: string; label: string; icon: typeof Clock }> = {
    waiting: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Waiting", icon: Clock },
    "in-consultation": { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "In Consultation", icon: Stethoscope },
    called: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Called", icon: Bell },
  };

  const recalculateWaitTimes = useCallback((q: WaitingPatient[]): WaitingPatient[] => {
    let waitAccumulator = 0;
    return q.map((p) => {
      if (p.status === "in-consultation") {
        return { ...p, estimatedWait: 0 };
      }
      if (p.status === "called") {
        return { ...p, estimatedWait: 5 };
      }
      waitAccumulator += 15;
      return { ...p, estimatedWait: waitAccumulator };
    });
  }, []);

  const moveUp = (id: string) => {
    const idx = queue.findIndex((p) => p.id === id);
    if (idx <= 0) return;
    const updated = [...queue];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setQueue(recalculateWaitTimes(updated.map((p, i) => ({ ...p, priority: i + 1 }))));
  };

  const moveDown = (id: string) => {
    const idx = queue.findIndex((p) => p.id === id);
    if (idx < 0 || idx >= queue.length - 1) return;
    const updated = [...queue];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setQueue(recalculateWaitTimes(updated.map((p, i) => ({ ...p, priority: i + 1 }))));
  };

  const callPatient = (id: string) => {
    setQueue(recalculateWaitTimes(queue.map((p) => (p.id === id ? { ...p, status: "called" as const } : p))));
  };

  const startConsultation = (id: string) => {
    setQueue(recalculateWaitTimes(queue.map((p) => (p.id === id ? { ...p, status: "in-consultation" as const } : p))));
  };

  const markDone = (id: string) => {
    setQueue(recalculateWaitTimes(queue.filter((p) => p.id !== id)));
  };

  const cancelPatient = (id: string) => {
    setQueue(recalculateWaitTimes(queue.filter((p) => p.id !== id)));
  };

  const callNext = () => {
    const nextWaiting = queue.find((p) => p.status === "waiting");
    if (nextWaiting) {
      callPatient(nextWaiting.id);
    }
  };

  const handlePhoneCall = (phone: string) => {
    window.open(`tel:${phone.replace(/\s/g, "")}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\s/g, "").replace("+", "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  const waitingCount = queue.filter((p) => p.status === "waiting").length;
  const inConsultation = queue.filter((p) => p.status === "in-consultation").length;
  const calledCount = queue.filter((p) => p.status === "called").length;
  const avgWaitTime = waitingCount > 0
    ? Math.round(queue.filter((p) => p.status === "waiting").reduce((sum, p) => sum + p.estimatedWait, 0) / waitingCount)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{queue.length}</p>
            <p className="text-xs text-muted-foreground">Total in Queue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{waitingCount}</p>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{calledCount}</p>
            <p className="text-xs text-muted-foreground">Called</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{inConsultation}</p>
            <p className="text-xs text-muted-foreground">In Consultation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-purple-600">~{avgWaitTime}min</p>
            <p className="text-xs text-muted-foreground">Avg. Wait</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <WalkInDialog
          trigger={
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-1" />
              Walk-in Check-in
            </Button>
          }
        />
        <Button variant="outline" size="sm" onClick={callNext} disabled={waitingCount === 0}>
          <Bell className="h-4 w-4 mr-1" />
          Call Next
        </Button>
      </div>

      {/* Queue List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {queue.map((patient, index) => {
              const StatusIcon = statusConfig[patient.status]?.icon ?? Clock;
              return (
                <div
                  key={patient.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    patient.status === "in-consultation"
                      ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20"
                      : patient.status === "called"
                        ? "border-green-300 bg-green-50 dark:bg-green-950/20"
                        : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => moveUp(patient.id)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => moveDown(patient.id)}
                        disabled={index === queue.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{patient.name}</p>
                        {patient.isWalkIn && (
                          <Badge variant="secondary" className="text-[10px]">Walk-in</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Arrived: {patient.arrivalTime}</span>
                        <span>|</span>
                        <span>Appt: {patient.appointmentTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{patient.service} - {patient.doctor}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {patient.status === "waiting" && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
                        <Timer className="h-3 w-3" />
                        <span>~{patient.estimatedWait}min</span>
                      </div>
                    )}

                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${statusConfig[patient.status]?.color ?? ""}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig[patient.status]?.label ?? patient.status}
                    </span>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handlePhoneCall(patient.phone)}
                        title="Call patient"
                      >
                        <Phone className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleWhatsApp(patient.phone)}
                        title="WhatsApp patient"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    </div>

                    <div className="flex gap-1">
                      {patient.status === "waiting" && (
                        <Button variant="outline" size="sm" onClick={() => callPatient(patient.id)} title="Call patient in">
                          <Bell className="h-3 w-3" />
                        </Button>
                      )}
                      {patient.status === "called" && (
                        <Button variant="outline" size="sm" onClick={() => startConsultation(patient.id)} title="Start consultation">
                          <Stethoscope className="h-3 w-3 text-yellow-600" />
                        </Button>
                      )}
                      {(patient.status === "called" || patient.status === "in-consultation") && (
                        <Button variant="outline" size="sm" onClick={() => markDone(patient.id)} title="Mark as done">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => cancelPatient(patient.id)} title="Remove from queue">
                        <XCircle className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {queue.length === 0 && (
              <div className="text-center py-8">
                <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No patients in the waiting room</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
