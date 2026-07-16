"use client";

import { Calendar, Loader2, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { createHoliday, deleteHoliday, fetchHolidays, type HolidayView } from "@/lib/data/holidays";
import { logger } from "@/lib/logger";
import { getLocalDateStr } from "@/lib/utils";

const typeColors: Record<string, string> = {
  national: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  clinic: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  doctor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface HolidaysClientProps {
  clinicId: string;
  initialHolidays: HolidayView[];
}

export default function HolidaysClient({ clinicId, initialHolidays }: HolidaysClientProps) {
  const { addToast } = useToast();
  const [holidays, setHolidays] = useState<HolidayView[]>(initialHolidays);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState<HolidayView["type"]>("clinic");
  const [newRecurring, setNewRecurring] = useState(false);

  async function reload() {
    const data = await fetchHolidays(clinicId);
    setHolidays(data);
  }

  async function addHoliday() {
    if (!newName.trim() || !newDate) return;
    setSaving(true);
    try {
      await createHoliday(clinicId, {
        name: newName.trim(),
        date: newDate,
        type: newType,
        recurring: newRecurring,
      });
      await reload();
      setNewName("");
      setNewDate("");
      setNewType("clinic");
      setNewRecurring(false);
      setShowForm(false);
      addToast("Holiday added", "success");
    } catch (err) {
      logger.warn("Failed to add holiday", { context: "admin/holidays", error: err });
      addToast("Failed to add holiday. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(id: string) {
    const previous = holidays;
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    try {
      await deleteHoliday(clinicId, id);
      addToast("Holiday removed", "success");
    } catch (err) {
      logger.warn("Failed to delete holiday", { context: "admin/holidays", error: err });
      setHolidays(previous);
      addToast("Failed to remove holiday. Please try again.", "error");
    }
  }

  const today = getLocalDateStr();
  const upcoming = [...holidays]
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = [...holidays]
    .filter((h) => h.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Holidays" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Holidays &amp; Closures</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 me-1" />
          Add Holiday
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-5 items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label>Holiday Name</Label>
                <Input
                  placeholder="e.g., Staff Training"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as HolidayView["type"])}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="national">National Holiday</option>
                  <option value="clinic">Clinic Closure</option>
                  <option value="doctor">Doctor Leave</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={newRecurring}
                  onChange={(e) => setNewRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="recurring" className="text-sm cursor-pointer">
                  Recurring
                </Label>
                <Button
                  onClick={addHoliday}
                  disabled={saving || !newName.trim() || !newDate}
                  className="ms-auto"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Upcoming Closures ({upcoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{holiday.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[holiday.type]}`}
                    >
                      {holiday.type}
                    </span>
                    {holiday.recurring && (
                      <Badge variant="outline" className="text-[10px]">
                        Recurring
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHoliday(holiday.id)}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming holidays
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Past Closures ({past.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {past.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between border rounded-lg p-3 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{holiday.date}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[holiday.type]}`}
                  >
                    {holiday.type}
                  </span>
                </div>
              ))}
              {past.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No past holidays</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
