"use client";

import { Clock, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const docs = await fetchDoctors(user.clinic_id);
      if (controller.signal.aborted) return;
      setDoctors(docs);
      const initialSchedules = docs.map((d) => ({ doctorId: d.id, days: defaultSchedule() }));
      setSchedules(initialSchedules);
      if (docs.length > 0) setSelectedDoctor(docs[0].id);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => {
      controller.abort();
    };
  }, []);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load persisted schedules from clinic config on top of the doctor list
  useEffect(() => {
    if (doctors.length === 0) return;
    const controller = new AbortController();
    fetch("/api/admin/working-hours", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(
        (json: {
          data: {
            doctorSchedules: Record<
              string,
              Record<string, { open: string; close: string; enabled: boolean }>
            >;
          };
        }) => {
          if (controller.signal.aborted) return;
          const saved = json.data?.doctorSchedules ?? {};
          setSchedules((prev) =>
            prev.map((s) => {
              const savedDays = saved[s.doctorId];
              if (!savedDays) return s;
              const mergedDays = { ...defaultSchedule() };
              for (const [dayKey, val] of Object.entries(savedDays)) {
                mergedDays[Number(dayKey)] = val;
              }
              return { ...s, days: mergedDays };
            }),
          );
        },
      )
      .catch(() => {
        /* use defaults */
      });
    return () => controller.abort();
  }, [doctors]);

  const currentSchedule = schedules.find((s) => s.doctorId === selectedDoctor);

  const updateDay = (day: number, field: "open" | "close" | "enabled", value: string | boolean) => {
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
      const doctorSchedules: Record<
        string,
        Record<string, { open: string; close: string; enabled: boolean }>
      > = {};
      for (const s of schedules) {
        doctorSchedules[s.doctorId] = Object.fromEntries(
          Object.entries(s.days).map(([day, val]) => [String(day), val]),
        );
      }
      const res = await fetch("/api/admin/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorSchedules }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silently surface error inline — could add toast if desired
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Working Hours" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Working Hours</h1>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
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
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
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
