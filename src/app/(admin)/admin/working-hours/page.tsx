"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getCurrentUser, fetchDoctors, type DoctorView } from "@/lib/data/client";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DoctorSchedule {
  doctorId: string;
  days: Record<number, { open: string; close: string; enabled: boolean }>;
}

const defaultSchedule = (): Record<number, { open: string; close: string; enabled: boolean }> => ({
  0: { open: "09:00", close: "17:00", enabled: false },
  1: { open: "09:00", close: "17:00", enabled: true },
  2: { open: "09:00", close: "17:00", enabled: true },
  3: { open: "09:00", close: "17:00", enabled: true },
  4: { open: "09:00", close: "17:00", enabled: true },
  5: { open: "09:00", close: "17:00", enabled: true },
  6: { open: "09:00", close: "13:00", enabled: true },
});

export default function WorkingHoursPage() {
  const [doctors, setDoctors] = useState<DoctorView[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const docs = await fetchDoctors(user.clinic_id);
    setDoctors(docs);
    const initialSchedules = docs.map((d) => ({ doctorId: d.id, days: defaultSchedule() }));
    setSchedules(initialSchedules);
    if (docs.length > 0) setSelectedDoctor(docs[0].id);
    setLoading(false);
  }
    load();
  }, []);
  const [saved, setSaved] = useState(false);

  const currentSchedule = schedules.find((s) => s.doctorId === selectedDoctor);

  const updateDay = (day: number, field: "open" | "close" | "enabled", value: string | boolean) => {
    setSchedules(
      schedules.map((s) =>
        s.doctorId === selectedDoctor
          ? { ...s, days: { ...s.days, [day]: { ...s.days[day], [field]: value } } }
          : s
      )
    );
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Working Hours</h1>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          {saved ? "Saved!" : "Save Changes"}
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
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="w-28">
                      <span className="text-sm font-medium">{day}</span>
                    </div>
                    <Switch
                      checked={daySchedule.enabled}
                      onCheckedChange={(checked) => updateDay(i, "enabled", checked)}
                    />
                    <Badge variant={daySchedule.enabled ? "default" : "secondary"} className="w-16 justify-center">
                      {daySchedule.enabled ? "Open" : "Closed"}
                    </Badge>
                    {daySchedule.enabled && (
                      <div className="flex items-center gap-2 ml-4">
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
