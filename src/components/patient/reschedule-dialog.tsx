"use client";

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Calendar, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "@/components/booking/calendar";
import { TimeSlotPicker } from "@/components/booking/time-slots";
import { formatDisplayDate } from "@/lib/utils";
import { useTenant } from "@/components/tenant-provider";
import { fetchAvailableSlots, fetchGeneratedSlots, fetchSlotBookingCounts } from "@/lib/data/client";

interface RescheduleAppointment {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
}

interface RescheduleDialogProps {
  appointment: RescheduleAppointment;
  onClose: () => void;
  onReschedule: (newDate: string, newTime: string) => void;
}

/**
 * RescheduleDialog
 *
 * Modal-style component that allows patients to pick a new date and time
 * for an existing appointment.
 */
export function RescheduleDialog({ appointment, onClose, onReschedule }: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const tenant = useTenant();

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [allSlots, setAllSlots] = useState<string[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setAllSlots([]);
      setSlotCounts({});
      return;
    }
    const clinicId = tenant?.clinicId ?? "";
    Promise.all([
      fetchAvailableSlots(clinicId, selectedDate, appointment.doctorId),
      fetchGeneratedSlots(clinicId, selectedDate, appointment.doctorId),
      fetchSlotBookingCounts(clinicId, selectedDate, appointment.doctorId),
    ]).then(([available, all, counts]) => {
      setAvailableSlots(available);
      setAllSlots(all);
      setSlotCounts(counts);
    }).catch(() => {
      setAvailableSlots([]);
      setAllSlots([]);
      setSlotCounts({});
    });
  }, [selectedDate, appointment.doctorId, tenant?.clinicId]);

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/booking/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          newDate: selectedDate,
          newTime: selectedTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to reschedule");
        return;
      }

      setSuccess(true);
      onReschedule(selectedDate, selectedTime);
    } catch (err) {
      logger.warn("Reschedule request failed", { context: "reschedule-dialog", error: err });
      setError("An error occurred while rescheduling");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardContent className="pt-6 text-center">
          <RefreshCw className="h-8 w-8 mx-auto text-green-600 mb-3" />
          <h3 className="font-semibold text-lg mb-1">Rescheduled!</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Your appointment has been moved to {formatDisplayDate(selectedDate, "fr", "long")} at {selectedTime}.
          </p>
          <Button variant="outline" onClick={onClose} className="mt-3">Close</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Reschedule Appointment
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Current: <Badge variant="outline">{formatDisplayDate(appointment.date, "fr", "long")}</Badge>{" "}
          at <Badge variant="outline">{appointment.time}</Badge>{" "}
          with {appointment.doctorName}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Select a new date:
          </p>
          <BookingCalendar
            selectedDate={selectedDate}
            onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(""); }}
          />
        </div>

        {selectedDate && (
          <div>
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Choose a new time:
            </p>
            <TimeSlotPicker
              slots={availableSlots}
              allSlots={allSlots}
              slotCounts={slotCounts}
              maxPerSlot={1}
              selectedSlot={selectedTime}
              onSelectSlot={setSelectedTime}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedTime || isSubmitting}
          >
            {isSubmitting ? "Rescheduling..." : "Confirm Reschedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
