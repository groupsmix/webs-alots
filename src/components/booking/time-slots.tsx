"use client";

import { Clock } from "lucide-react";

interface TimeSlotPickerProps {
  slots: string[];
  allSlots?: string[];
  slotCounts?: Record<string, number>;
  maxPerSlot?: number;
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
}

export function TimeSlotPicker({ slots, allSlots, slotCounts, maxPerSlot = 1, selectedSlot, onSelectSlot }: TimeSlotPickerProps) {
  const displaySlots = allSlots && allSlots.length > 0 ? allSlots : slots;

  if (displaySlots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm">No available slots for this date.</p>
      </div>
    );
  }

  const morningSlots = displaySlots.filter((s) => {
    const hour = parseInt(s.split(":")[0]);
    return hour < 12;
  });
  const afternoonSlots = displaySlots.filter((s) => {
    const hour = parseInt(s.split(":")[0]);
    return hour >= 12;
  });

  const renderSlot = (slot: string) => {
    const isAvailable = slots.includes(slot);
    const count = slotCounts?.[slot] ?? 0;
    const isFull = count >= maxPerSlot;

    if (!isAvailable || isFull) {
      return (
        <button
          key={slot}
          disabled
          className="rounded-lg border px-3 py-2 text-sm font-medium bg-muted/50 text-muted-foreground line-through cursor-not-allowed opacity-60"
          title="This slot is taken"
        >
          {slot}
        </button>
      );
    }

    return (
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
    );
  };

  return (
    <div className="space-y-4">
      {morningSlots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Morning</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {morningSlots.map(renderSlot)}
          </div>
        </div>
      )}
      {afternoonSlots.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Afternoon</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {afternoonSlots.map(renderSlot)}
          </div>
        </div>
      )}
    </div>
  );
}
