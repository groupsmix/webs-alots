"use client";

import { useState } from "react";
import { Moon, Sun, Clock, Plus, Trash2, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GardeType, GardeScheduleEntry } from "@/lib/morocco";

interface GardeSchedulerProps {
  doctors: { id: string; name: string }[];
  entries: GardeScheduleEntry[];
  onAddEntry?: (entry: Omit<GardeScheduleEntry, "id">) => void;
  onRemoveEntry?: (id: string) => void;
  clinicId: string;
  readOnly?: boolean;
}

const GARDE_CONFIG: Record<GardeType, { label: string; labelAr: string; color: string; icon: typeof Moon }> = {
  garde: {
    label: "Garde",
    labelAr: "مناوبة",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: Moon,
  },
  astreinte: {
    label: "Astreinte",
    labelAr: "استعداد",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: Clock,
  },
};

/**
 * GardeScheduler
 *
 * Manages on-duty (garde) and on-call (astreinte) schedules for doctors.
 * Common in Moroccan clinics for night duty and weekend rotation.
 *
 * - Garde: Doctor must be physically present at the clinic
 * - Astreinte: Doctor is on-call and can be reached by phone
 */
export function GardeScheduler({
  doctors,
  entries,
  onAddEntry,
  onRemoveEntry,
  clinicId,
  readOnly = false,
}: GardeSchedulerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDoctorId, setNewDoctorId] = useState(doctors[0]?.id ?? "");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newType, setNewType] = useState<GardeType>("garde");
  const [newStartTime, setNewStartTime] = useState("20:00");
  const [newEndTime, setNewEndTime] = useState("08:00");
  const [newNotes, setNewNotes] = useState("");
  const [filterType, setFilterType] = useState<GardeType | "all">("all");
  const [filterDoctor, setFilterDoctor] = useState<string>("all");

  const handleAdd = () => {
    const doctor = doctors.find((d) => d.id === newDoctorId);
    if (!doctor) return;

    onAddEntry?.({
      doctorId: newDoctorId,
      doctorName: doctor.name,
      clinicId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      type: newType,
      notes: newNotes || undefined,
    });

    setShowAddForm(false);
    setNewNotes("");
  };

  const filteredEntries = entries.filter((e) => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterDoctor !== "all" && e.doctorId !== filterDoctor) return false;
    return true;
  });

  // Group by date
  const groupedByDate = new Map<string, GardeScheduleEntry[]>();
  for (const entry of filteredEntries) {
    const existing = groupedByDate.get(entry.date);
    if (existing) {
      existing.push(entry);
    } else {
      groupedByDate.set(entry.date, [entry]);
    }
  }

  const sortedDates = Array.from(groupedByDate.keys()).sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Planning de Garde</h2>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v as GardeType | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="garde">Garde</SelectItem>
            <SelectItem value="astreinte">Astreinte</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDoctor} onValueChange={setFilterDoctor}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Médecin..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les médecins</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nouvelle garde / astreinte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Médecin</Label>
                <Select value={newDoctorId} onValueChange={setNewDoctorId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newType}
                  onValueChange={(v) => setNewType(v as GardeType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="garde">Garde (présence obligatoire)</SelectItem>
                    <SelectItem value="astreinte">Astreinte (disponible par tél.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Horaires</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">→</span>
                  <Input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes (optionnel)</Label>
                <Input
                  placeholder="Ex: Remplacement Dr. X, Garde de week-end..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleAdd}>
                Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule list grouped by date */}
      {sortedDates.map((date) => {
        const dateEntries = groupedByDate.get(date) ?? [];
        const d = new Date(date);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        return (
          <Card key={date} className={isWeekend ? "border-orange-200 dark:border-orange-800" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">
                  {d.toLocaleDateString("fr-MA", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {isWeekend && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Week-end
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dateEntries.map((entry) => {
                  const config = GARDE_CONFIG[entry.type];
                  const TypeIcon = config.icon;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{entry.doctorName}</p>
                            <Badge
                              className={`text-xs ${config.color}`}
                              variant="secondary"
                            >
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entry.startTime} → {entry.endTime}
                            {entry.notes && ` — ${entry.notes}`}
                          </p>
                        </div>
                      </div>
                      {!readOnly && onRemoveEntry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveEntry(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {sortedDates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Sun className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucune garde programmée
            </p>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Moon className="h-3 w-3" />
          <span>Garde = présence obligatoire au cabinet</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Astreinte = disponible par téléphone</span>
        </div>
      </div>
    </div>
  );
}
