"use client";

import { Dumbbell, Plus, Search, Clock, Users, Calendar } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface FitnessClass {
  id: string;
  name: string;
  description: string | null;
  trainer: { id: string; name: string } | null;
  day_of_week: number;
  start_time: string;
  duration_min: number;
  max_capacity: number;
  location: string | null;
  is_recurring: boolean;
  is_active: boolean;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<FitnessClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newClass, setNewClass] = useState({
    name: "",
    description: "",
    day_of_week: 1,
    start_time: "09:00",
    duration_min: 60,
    max_capacity: 20,
    location: "",
    is_recurring: true,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { classes: FitnessClass[] };
      setClasses(data.classes ?? []);
    } catch (err) {
      logger.warn("Failed to load classes", { context: "classes-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClass.name,
          description: newClass.description || undefined,
          day_of_week: newClass.day_of_week,
          start_time: newClass.start_time,
          duration_min: newClass.duration_min,
          max_capacity: newClass.max_capacity,
          location: newClass.location || undefined,
          is_recurring: newClass.is_recurring,
          is_active: newClass.is_active,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreateOpen(false);
      setNewClass({ name: "", description: "", day_of_week: 1, start_time: "09:00", duration_min: 60, max_capacity: 20, location: "", is_recurring: true, is_active: true });
      void loadClasses();
    } catch (err) {
      logger.warn("Failed to create class", { context: "classes-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const filtered = classes.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Classes" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="h-6 w-6" />
            Class Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage fitness classes, schedules, and capacity
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Class
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{classes.length}</p>
                <p className="text-xs text-muted-foreground">Total Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{classes.reduce((sum, c) => sum + c.max_capacity, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{classes.filter((c) => c.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes..." className="pl-9" />
      </div>

      {/* Weekly Schedule View */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No classes found. Create your first class to get started.
            </CardContent>
          </Card>
        ) : (
          DAYS.map((day, idx) => {
            const dayClasses = filtered.filter((c) => c.day_of_week === idx);
            if (dayClasses.length === 0) return null;
            return (
              <div key={day}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{day}</h3>
                <div className="space-y-2">
                  {dayClasses.map((cls) => (
                    <Card key={cls.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium">{cls.start_time}</div>
                            <div>
                              <p className="text-sm font-medium">{cls.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {cls.duration_min}min &middot; {cls.max_capacity} spots
                                {cls.trainer ? ` · ${cls.trainer.name}` : ""}
                                {cls.location ? ` · ${cls.location}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {cls.is_recurring && <Badge variant="secondary" className="text-[10px]">Recurring</Badge>}
                            <Badge variant={cls.is_active ? "default" : "secondary"}>
                              {cls.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} placeholder="e.g., Yoga Flow" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newClass.description} onChange={(e) => setNewClass({ ...newClass, description: e.target.value })} placeholder="Class description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <select value={newClass.day_of_week} onChange={(e) => setNewClass({ ...newClass, day_of_week: Number(e.target.value) })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={newClass.start_time} onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={newClass.duration_min} onChange={(e) => setNewClass({ ...newClass, duration_min: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Max Capacity</Label>
                <Input type="number" value={newClass.max_capacity} onChange={(e) => setNewClass({ ...newClass, max_capacity: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={newClass.location} onChange={(e) => setNewClass({ ...newClass, location: e.target.value })} placeholder="e.g., Studio A" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Recurring Weekly</Label>
              <Switch checked={newClass.is_recurring} onCheckedChange={(checked) => setNewClass({ ...newClass, is_recurring: checked })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={newClass.is_active} onCheckedChange={(checked) => setNewClass({ ...newClass, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newClass.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
