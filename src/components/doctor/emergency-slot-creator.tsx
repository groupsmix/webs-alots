"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { EmergencySlotView as EmergencySlot } from "@/lib/data/client";
import { logger } from "@/lib/logger";

interface EmergencySlotCreatorProps {
  doctorId: string;
}

/**
 * EmergencySlotCreator
 *
 * Allows doctors to open urgent, unscheduled time slots
 * for emergency patient appointments.
 */
export function EmergencySlotCreator({ doctorId }: EmergencySlotCreatorProps) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("12:00");
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlots, setCreatedSlots] = useState<EmergencySlot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/booking/emergency-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          doctorId,
          date,
          startTime,
          durationMin: duration,
          reason: reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to create slot");
        return;
      }

      // Fetch updated slots
      const slotsRes = await fetch(`/api/booking/emergency-slot?doctorId=${doctorId}&date=${date}`);
      const slotsData = await slotsRes.json();
      setCreatedSlots(slotsData.slots ?? []);

      setShowForm(false);
      setReason("");
    } catch (err) {
      logger.warn("Emergency slot creation failed", { context: "emergency-slot", error: err });
      setError("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Emergency Slots
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Slot
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-orange-50 dark:bg-orange-950/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="es-date" className="text-xs">Date</Label>
                <Input
                  id="es-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="es-time" className="text-xs">Start Time</Label>
                <Input
                  id="es-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="es-duration" className="text-xs">Duration (minutes)</Label>
              <Input
                id="es-duration"
                type="number"
                min={15}
                max={120}
                step={15}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="es-reason" className="text-xs">Reason (optional)</Label>
              <Input
                id="es-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Urgent follow-up needed"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isSubmitting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSubmitting ? "Creating..." : "Create Emergency Slot"}
              </Button>
            </div>
          </div>
        )}

        {createdSlots.length > 0 ? (
          <div className="space-y-2">
            {createdSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm">
                    {slot.date} &middot; {slot.startTime} - {slot.endTime}
                  </span>
                  {slot.reason && (
                    <span className="text-xs text-muted-foreground">({slot.reason})</span>
                  )}
                </div>
                <Badge variant={slot.isBooked ? "secondary" : "outline"}>
                  {slot.isBooked ? "Booked" : "Available"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No emergency slots created yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
