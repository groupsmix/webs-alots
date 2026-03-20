"use client";

import { useState } from "react";
import { Clock, ArrowRight, CheckCircle, AlertTriangle, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { waitingRoom } from "@/lib/demo-data";
import type { WaitingRoomEntry } from "@/lib/demo-data";

export default function WaitingRoomPage() {
  const [entries, setEntries] = useState<WaitingRoomEntry[]>([...waitingRoom]);

  const waitingEntries = entries.filter((e) => e.status === "waiting");
  const inConsultation = entries.filter((e) => e.status === "in-consultation");
  const doneEntries = entries.filter((e) => e.status === "done");

  const getWaitTime = (arrivedAt: string) => {
    const arrived = new Date(arrivedAt);
    const now = new Date();
    const diffMin = Math.max(0, Math.round((now.getTime() - arrived.getTime()) / 60000));
    if (diffMin < 60) return `${diffMin}m`;
    return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
  };

  const handleStartConsultation = (entryId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: "in-consultation" as const } : e))
    );
  };

  const handleMarkDone = (entryId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: "done" as const } : e))
    );
  };

  const priorityOrder = { urgent: 0, normal: 1, "follow-up": 2 };
  const sortedWaiting = [...waitingEntries].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Waiting Room</h1>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Waiting: {waitingEntries.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            In Consultation: {inConsultation.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Done: {doneEntries.length}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Waiting Column */}
        <div>
          <h2 className="text-sm font-semibold text-orange-600 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Waiting ({sortedWaiting.length})
          </h2>
          <div className="space-y-3">
            {sortedWaiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patients waiting.</p>
            ) : (
              sortedWaiting.map((entry) => (
                <Card key={entry.id} className="border-l-4 border-l-orange-400">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar>
                        <AvatarFallback className="text-xs bg-orange-100 text-orange-700">
                          {entry.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{entry.patientName}</p>
                        <p className="text-xs text-muted-foreground">{entry.serviceName}</p>
                      </div>
                      {entry.priority === "urgent" && (
                        <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Urgent
                        </Badge>
                      )}
                      {entry.priority === "follow-up" && (
                        <Badge variant="secondary" className="text-[10px]">Follow-up</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>Scheduled: {entry.scheduledTime}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Waiting: {getWaitTime(entry.arrivedAt)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleStartConsultation(entry.id)}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Start Consultation
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* In Consultation Column */}
        <div>
          <h2 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            In Consultation ({inConsultation.length})
          </h2>
          <div className="space-y-3">
            {inConsultation.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active consultations.</p>
            ) : (
              inConsultation.map((entry) => (
                <Card key={entry.id} className="border-l-4 border-l-blue-400">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar>
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {entry.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{entry.patientName}</p>
                        <p className="text-xs text-muted-foreground">{entry.serviceName}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      In session for: {getWaitTime(entry.arrivedAt)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-green-600"
                      onClick={() => handleMarkDone(entry.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark as Done
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Done Column */}
        <div>
          <h2 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed ({doneEntries.length})
          </h2>
          <div className="space-y-3">
            {doneEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed consultations yet.</p>
            ) : (
              doneEntries.map((entry) => (
                <Card key={entry.id} className="border-l-4 border-l-green-400 opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="text-xs bg-green-100 text-green-700">
                          {entry.patientName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{entry.patientName}</p>
                        <p className="text-xs text-muted-foreground">{entry.serviceName}</p>
                      </div>
                      <Badge variant="success" className="text-[10px]">Done</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
