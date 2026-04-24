"use client";

import { Calendar, Plus, Trash2, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: "national" | "clinic" | "doctor";
  recurring: boolean;
}

const initialHolidays: Holiday[] = [
  { id: "h1", name: "Throne Day", date: "2026-07-30", type: "national", recurring: true },
  { id: "h2", name: "Independence Day", date: "2026-11-18", type: "national", recurring: true },
  { id: "h3", name: "Labour Day", date: "2026-05-01", type: "national", recurring: true },
  { id: "h4", name: "Eid Al-Fitr", date: "2026-03-30", type: "national", recurring: false },
  { id: "h5", name: "Eid Al-Adha", date: "2026-06-07", type: "national", recurring: false },
  { id: "h6", name: "Clinic Annual Maintenance", date: "2026-08-15", type: "clinic", recurring: false },
  { id: "h7", name: "Dr. Ahmed Conference", date: "2026-04-10", type: "doctor", recurring: false },
  { id: "h8", name: "Staff Training Day", date: "2026-05-15", type: "clinic", recurring: false },
];

const typeColors: Record<string, string> = {
  national: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  clinic: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  doctor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState<Holiday["type"]>("clinic");

  const removeHoliday = (id: string) => {
    setHolidays(holidays.filter((h) => h.id !== id));
  };

  const addHoliday = () => {
    if (!newName || !newDate) return;
    setHolidays([
      ...holidays,
      {
        id: `h${Date.now()}`,
        name: newName,
        date: newDate,
        type: newType,
        recurring: false,
      },
    ]);
    setNewName("");
    setNewDate("");
    setShowForm(false);
  };

  const upcoming = [...holidays]
    .filter((h) => h.date >= new Date().toISOString().split("T")[0])
    .sort((a, b) => a.date.localeCompare(b.date));

  const past = [...holidays]
    .filter((h) => h.date < new Date().toISOString().split("T")[0])
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Holidays" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Holidays & Closures</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Holiday
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
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
                  onChange={(e) => setNewType(e.target.value as Holiday["type"])}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="national">National Holiday</option>
                  <option value="clinic">Clinic Closure</option>
                  <option value="doctor">Doctor Leave</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={addHoliday} className="w-full">
                  Add
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
                <div key={holiday.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{holiday.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[holiday.type]}`}>
                      {holiday.type}
                    </span>
                    {holiday.recurring && <Badge variant="outline" className="text-[10px]">Recurring</Badge>}
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
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming holidays</p>
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
                <div key={holiday.id} className="flex items-center justify-between border rounded-lg p-3 opacity-60">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{holiday.date}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[holiday.type]}`}>
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
