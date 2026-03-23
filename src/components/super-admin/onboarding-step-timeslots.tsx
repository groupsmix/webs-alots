"use client";

import {
  Clock,
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export interface TimeSlotFormData {
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_capacity: string;
  buffer_minutes: string;
}

export interface DoctorTimeSlots {
  doctorId: string;
  doctorName: string;
  slots: TimeSlotFormData[];
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface StepTimeSlotsProps {
  doctorSlots: DoctorTimeSlots[];
  loading: boolean;
  onAddSlot: (doctorIndex: number) => void;
  onRemoveSlot: (doctorIndex: number, slotIndex: number) => void;
  onUpdateSlot: (
    doctorIndex: number,
    slotIndex: number,
    field: keyof TimeSlotFormData,
    value: string | number,
  ) => void;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: () => void;
}

export function OnboardingStepTimeSlots({
  doctorSlots,
  loading,
  onAddSlot,
  onRemoveSlot,
  onUpdateSlot,
  onBack,
  onSkip,
  onSubmit,
}: StepTimeSlotsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Step 4: Configure Time Slots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {doctorSlots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No doctors were added in Step 2. You can skip this step or go
              back to add doctors.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Add Staff
              </Button>
              <Button onClick={onSkip}>
                Skip & Finish
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Configure weekly availability for each doctor. Default is
              Mon-Fri 9-12 &amp; 14-17. Adjust as needed.
            </p>

            {doctorSlots.map((doctor, dIndex) => (
              <div key={doctor.doctorId} className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {doctor.doctorName}
                </h3>

                <div className="space-y-2 pl-2">
                  {doctor.slots.map((slot, sIndex) => (
                    <div
                      key={sIndex}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                        value={slot.day_of_week}
                        onChange={(e) =>
                          onUpdateSlot(
                            dIndex,
                            sIndex,
                            "day_of_week",
                            parseInt(e.target.value),
                          )
                        }
                      >
                        {DAY_NAMES.map((name, i) => (
                          <option key={i} value={i}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="time"
                        className="w-28"
                        value={slot.start_time}
                        onChange={(e) =>
                          onUpdateSlot(
                            dIndex,
                            sIndex,
                            "start_time",
                            e.target.value,
                          )
                        }
                      />
                      <span className="text-muted-foreground text-sm">
                        to
                      </span>
                      <Input
                        type="time"
                        className="w-28"
                        value={slot.end_time}
                        onChange={(e) =>
                          onUpdateSlot(
                            dIndex,
                            sIndex,
                            "end_time",
                            e.target.value,
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() =>
                          onRemoveSlot(dIndex, sIndex)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddSlot(dIndex)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Slot
                </Button>

                {dIndex < doctorSlots.length - 1 && (
                  <Separator />
                )}
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onSkip}
                >
                  Skip
                </Button>
                <Button onClick={onSubmit} disabled={loading}>
                  {loading && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Save Slots & Finish
                  <Check className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
