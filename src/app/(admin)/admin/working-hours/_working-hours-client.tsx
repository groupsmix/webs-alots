"use client";

import { Clock, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { DoctorSchedules, WorkingHoursDoctor } from "@/lib/data/working-hours";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DaySchedule {
  open: string;
  close: string;
  enabled: boolean;
}

const defaultSchedule = (): Record<number, DaySchedule> => ({
  0: { open: "09:00", close: "17:00", enabled: false },
  1: { open: "09:00", close: "17:00", enabled: true },
  2: { open: "09:00", close: "17:00", enabled: true },
  3: { open: "09:00", close: "17:00", enabled: true },
  4: { open: "09:00", close: "17:00", enabled: true },
  5: { open: "09:00", close: "17:00", enabled: true },
  6: { open: "09:00", close: "13:00", enabled: true },
});

interface WorkingHoursClientProps {
  doctors: WorkingHoursDoctor[];
  doctorSchedules: DoctorSchedules;
}

export default function WorkingHoursClient({ doctors, doctorSchedules }: WorkingHoursClientProps) {
  const { addToast } = useToast();
  const [selectedDoctor, setSelectedDoctor] = useState(doctors[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [schedules, setSchedules] = useState(() => {
    const initial = doctors.map((doctor) => {
      const mergedDays = { ...defaultSchedule() };
      const saved = doctorSchedules[doctor.id];
      if (saved) {
        for (const [dayKey, val] of Object.entries(saved)) {
          mergedDays[Number(dayKey)] = val;
        }
      }
      return { doctorId: doctor.id, days: mergedDays };
    });
    return initial;
  });

  const currentSchedule = schedules.find((s) => s.doctorId === selectedDoctor);

  const updateDay = (day: number, field: keyof DaySchedule, value: string | boolean) => {
    setSchedules(
      schedules.map((s) =>
        s.doctorId === selectedDoctor
          ? { ...s, days: { ...s.days, [day]: { ...s.days[day], [field]: value } } }
          : s,
      ),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: DoctorSchedules = {};
      for (const s of schedules) {
        payload[s.doctorId] = Object.fromEntries(
          Object.entries(s.days).map(([day, val]) => [String(day), val]),
        );
      }
      const res = await fetch("/api/admin/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorSchedules: payload }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setSaved(true);
      addToast("Working hours saved", "success");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      addToast("Failed to save working hours", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Working Hours" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Working Hours</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 me-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 me-1" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {doctors.map((doctor) => (
          <Button
            key={doctor.id}
            variant={selectedDoctor === doctor.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDoctor(doctor.id)}
          >
            {doctor.name}
          </Button>
        ))}
      </div>

      {currentSchedule && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule for {doctors.find((d) => d.id === selectedDoctor)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dayNames.map((day, i) => {
                const daySchedule = currentSchedule.days[i];
                return (
                  <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="w-28">
                      <span className="text-sm font-medium">{day}</span>
                    </div>
                    <Switch
                      checked={daySchedule.enabled}
                      onCheckedChange={(checked) => updateDay(i, "enabled", checked)}
                    />
                    <Badge
                      variant={daySchedule.enabled ? "default" : "secondary"}
                      className="w-16 justify-center"
                    >
                      {daySchedule.enabled ? "Open" : "Closed"}
                    </Badge>
                    {daySchedule.enabled && (
                      <div className="flex items-center gap-2 ms-4">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          type="time"
                          value={daySchedule.open}
                          onChange={(e) => updateDay(i, "open", e.target.value)}
                          className="w-32"
                        />
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          type="time"
                          value={daySchedule.close}
                          onChange={(e) => updateDay(i, "close", e.target.value)}
                          className="w-32"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
