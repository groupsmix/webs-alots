"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Phone, MessageCircle, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createClient,
  fetchTodayAppointments,
  type AppointmentView,
} from "@/lib/data/client";

interface RealtimeWaitingRoomProps {
  clinicId: string;
  onCallIn?: (appointmentId: string) => void;
}

export function RealtimeWaitingRoom({ clinicId, onCallIn }: RealtimeWaitingRoomProps) {
  const [waitingPatients, setWaitingPatients] = useState<AppointmentView[]>([]);

  const loadWaitingPatients = useCallback(async () => {
    const appts = await fetchTodayAppointments(clinicId);
    const waiting = appts.filter(
      (a) => a.status === "confirmed" || a.status === "in-progress",
    );
    setWaitingPatients(waiting);
  }, [clinicId]);

  useEffect(() => {
    loadWaitingPatients();
  }, [loadWaitingPatients]);

  // Set up Supabase Realtime subscription for appointment changes
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("waiting-room-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          // Reload waiting list when any appointment changes
          loadWaitingPatients();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, loadWaitingPatients]);

  const handleCallPatient = (phone: string) => {
    window.open(`tel:${phone.replace(/\s/g, "")}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\s/g, "").replace("+", "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Waiting Room
          {waitingPatients.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {waitingPatients.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {waitingPatients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No patients waiting.
          </p>
        ) : (
          <div className="space-y-2">
            {waitingPatients.map((apt, i) => (
              <div
                key={apt.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{apt.patientName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {apt.serviceName} · {apt.time}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. wait: ~{(i + 1) * 15}min
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onCallIn?.(apt.id)}
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Call In
                  </Button>
                  <div className="flex gap-1">
                    {apt.patientPhone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleCallPatient(apt.patientPhone!)}
                        title="Call"
                      >
                        <Phone className="h-3 w-3 text-blue-600" />
                      </Button>
                    )}
                    {apt.patientPhone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleWhatsApp(apt.patientPhone!)}
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3 text-green-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
