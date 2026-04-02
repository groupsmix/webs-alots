"use client";

import { Dumbbell, Plus, Search, TrendingUp, Weight, Ruler } from "lucide-react";
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
import { logger } from "@/lib/logger";

interface ProgressRecord {
  id: string;
  member: { id: string; name: string } | null;
  recorder: { id: string; name: string } | null;
  recorded_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  bmi: number | null;
  notes: string | null;
}

export default function ProgressTrackingPage() {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newRecord, setNewRecord] = useState({
    member_id: "",
    weight_kg: "",
    body_fat_pct: "",
    muscle_mass_kg: "",
    bmi: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/progress-tracking");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { records: ProgressRecord[] };
      setRecords(data.records ?? []);
    } catch (err) {
      logger.warn("Failed to load progress records", { context: "progress-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/progress-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: newRecord.member_id,
          weight_kg: newRecord.weight_kg ? Number(newRecord.weight_kg) : undefined,
          body_fat_pct: newRecord.body_fat_pct ? Number(newRecord.body_fat_pct) : undefined,
          muscle_mass_kg: newRecord.muscle_mass_kg ? Number(newRecord.muscle_mass_kg) : undefined,
          bmi: newRecord.bmi ? Number(newRecord.bmi) : undefined,
          notes: newRecord.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreateOpen(false);
      setNewRecord({ member_id: "", weight_kg: "", body_fat_pct: "", muscle_mass_kg: "", bmi: "", notes: "" });
      void loadRecords();
    } catch (err) {
      logger.warn("Failed to create progress record", { context: "progress-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const filtered = records.filter(
    (r) => r.member?.name?.toLowerCase().includes(search.toLowerCase()) ?? true,
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
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Progress Tracking" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Progress Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track member body measurements and fitness progress
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Record
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Ruler className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{records.length}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Weight className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {records.filter((r) => r.weight_kg !== null).length > 0
                    ? (records.filter((r) => r.weight_kg !== null).reduce((sum, r) => sum + (r.weight_kg ?? 0), 0) / records.filter((r) => r.weight_kg !== null).length).toFixed(1)
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg Weight (kg)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Dumbbell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {new Set(records.map((r) => r.member?.id).filter(Boolean)).size}
                </p>
                <p className="text-xs text-muted-foreground">Members Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by member name..." className="pl-9" />
      </div>

      {/* Records List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No progress records found. Start tracking member progress.
            </CardContent>
          </Card>
        ) : (
          filtered.map((record) => (
            <Card key={record.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{record.member?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{record.recorded_at}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {record.weight_kg !== null && (
                      <Badge variant="secondary">{record.weight_kg} kg</Badge>
                    )}
                    {record.body_fat_pct !== null && (
                      <Badge variant="secondary">{record.body_fat_pct}% BF</Badge>
                    )}
                    {record.muscle_mass_kg !== null && (
                      <Badge variant="secondary">{record.muscle_mass_kg} kg MM</Badge>
                    )}
                    {record.bmi !== null && (
                      <Badge variant="secondary">BMI {record.bmi}</Badge>
                    )}
                  </div>
                </div>
                {record.notes && (
                  <p className="text-xs text-muted-foreground mt-2">{record.notes}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>New Progress Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Member ID</Label>
              <Input value={newRecord.member_id} onChange={(e) => setNewRecord({ ...newRecord, member_id: e.target.value })} placeholder="Member UUID" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.1" value={newRecord.weight_kg} onChange={(e) => setNewRecord({ ...newRecord, weight_kg: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Body Fat (%)</Label>
                <Input type="number" step="0.1" value={newRecord.body_fat_pct} onChange={(e) => setNewRecord({ ...newRecord, body_fat_pct: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Muscle Mass (kg)</Label>
                <Input type="number" step="0.1" value={newRecord.muscle_mass_kg} onChange={(e) => setNewRecord({ ...newRecord, muscle_mass_kg: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>BMI</Label>
                <Input type="number" step="0.1" value={newRecord.bmi} onChange={(e) => setNewRecord({ ...newRecord, bmi: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={newRecord.notes} onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newRecord.member_id}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
