"use client";

import { useState } from "react";
import { User, Clock, ArrowUp, ArrowDown, CheckCircle2, XCircle, Bell, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WaitingPatient {
  id: string;
  name: string;
  arrivalTime: string;
  appointmentTime: string;
  doctor: string;
  service: string;
  status: "waiting" | "in-consultation" | "called";
  priority: number;
}

/**
 * WaitingRoomManager
 *
 * Manages the patient queue: check-in, order, estimated wait time.
 */
export function WaitingRoomManager() {
  const [queue, setQueue] = useState<WaitingPatient[]>([
    {
      id: "w1",
      name: "Fatima Zahra",
      arrivalTime: "09:05",
      appointmentTime: "09:30",
      doctor: "Dr. Ahmed",
      service: "General Consultation",
      status: "in-consultation",
      priority: 1,
    },
    {
      id: "w2",
      name: "Mohammed Ali",
      arrivalTime: "09:15",
      appointmentTime: "10:00",
      doctor: "Dr. Ahmed",
      service: "Follow-up Visit",
      status: "called",
      priority: 2,
    },
    {
      id: "w3",
      name: "Khadija Benali",
      arrivalTime: "09:30",
      appointmentTime: "10:30",
      doctor: "Dr. Ahmed",
      service: "Blood Test",
      status: "waiting",
      priority: 3,
    },
    {
      id: "w4",
      name: "Youssef Amrani",
      arrivalTime: "09:45",
      appointmentTime: "11:00",
      doctor: "Dr. Ahmed",
      service: "General Consultation",
      status: "waiting",
      priority: 4,
    },
    {
      id: "w5",
      name: "Amina Tazi",
      arrivalTime: "10:00",
      appointmentTime: "11:30",
      doctor: "Dr. Ahmed",
      service: "Vaccination",
      status: "waiting",
      priority: 5,
    },
  ]);

  const statusConfig: Record<string, { color: string; label: string }> = {
    waiting: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Waiting" },
    "in-consultation": { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "In Consultation" },
    called: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Called" },
  };

  const moveUp = (id: string) => {
    const idx = queue.findIndex((p) => p.id === id);
    if (idx <= 0) return;
    const updated = [...queue];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setQueue(updated.map((p, i) => ({ ...p, priority: i + 1 })));
  };

  const moveDown = (id: string) => {
    const idx = queue.findIndex((p) => p.id === id);
    if (idx < 0 || idx >= queue.length - 1) return;
    const updated = [...queue];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setQueue(updated.map((p, i) => ({ ...p, priority: i + 1 })));
  };

  const callPatient = (id: string) => {
    setQueue(queue.map((p) => (p.id === id ? { ...p, status: "called" as const } : p)));
  };

  const markDone = (id: string) => {
    setQueue(queue.filter((p) => p.id !== id));
  };

  const cancelPatient = (id: string) => {
    setQueue(queue.filter((p) => p.id !== id));
  };

  const waitingCount = queue.filter((p) => p.status === "waiting").length;
  const avgWaitTime = waitingCount * 15;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{queue.length}</p>
            <p className="text-xs text-muted-foreground">Total in Queue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{waitingCount}</p>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">{queue.filter((p) => p.status === "in-consultation").length}</p>
            <p className="text-xs text-muted-foreground">In Consultation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold">~{avgWaitTime}min</p>
            <p className="text-xs text-muted-foreground">Est. Wait Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-1" />
          Walk-in Check-in
        </Button>
        <Button variant="outline" size="sm">
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
            {queue.map((patient, index) => (
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
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{patient.name}</p>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[patient.status]?.color ?? ""}`}>
                    {statusConfig[patient.status]?.label ?? patient.status}
                  </span>
                  <div className="flex gap-1">
                    {patient.status === "waiting" && (
                      <Button variant="outline" size="sm" onClick={() => callPatient(patient.id)} title="Call patient">
                        <Bell className="h-3 w-3" />
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
            ))}
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
