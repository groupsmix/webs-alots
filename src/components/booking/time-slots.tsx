"use client";

import { Clock } from "lucide-react";

interface TimeSlotPickerProps {
  slots: string[];
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
}

export function TimeSlotPicker({ slots, selectedSlot, onSelectSlot }: TimeSlotPickerProps) {
  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">No available slots for this date.</p>
      </div>
    );
  }

  const morningSlots = slots.filter((s) => {
    const hour = parseInt(s.split(":")[0]);
    return hour < 12;
  });
  const afternoonSlots = slots.filter((s) => {
    const hour = parseInt(s.split(":")[0]);
    return hour >= 12;
  });

  return (
    <div className="space-y-4">
      {morningSlots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Morning</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {morningSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => onSelectSlot(slot)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedSlot === slot
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}
      {afternoonSlots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Afternoon</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {afternoonSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => onSelectSlot(slot)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedSlot === slot
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
