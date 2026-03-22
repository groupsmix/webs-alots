"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Baby, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCurrentUser,
  fetchMilestones,
  createMilestone,
  updateMilestone,
  fetchPatients,
  type MilestoneView,
  type PatientView,
} from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

const MILESTONE_TEMPLATES: Record<string, { milestone: string; expectedAgeMonths: number }[]> = {
  motor: [
    { milestone: "Holds head steady", expectedAgeMonths: 3 },
    { milestone: "Rolls over", expectedAgeMonths: 5 },
    { milestone: "Sits without support", expectedAgeMonths: 6 },
    { milestone: "Crawls", expectedAgeMonths: 9 },
    { milestone: "Pulls to stand", expectedAgeMonths: 10 },
    { milestone: "Walks independently", expectedAgeMonths: 12 },
    { milestone: "Runs", expectedAgeMonths: 18 },
    { milestone: "Kicks a ball", expectedAgeMonths: 24 },
  ],
  language: [
    { milestone: "Coos and babbles", expectedAgeMonths: 3 },
    { milestone: "Responds to name", expectedAgeMonths: 6 },
    { milestone: "Says first words", expectedAgeMonths: 12 },
    { milestone: "Says 2-word phrases", expectedAgeMonths: 24 },
    { milestone: "Speaks in sentences", expectedAgeMonths: 36 },
  ],
  social: [
    { milestone: "Social smile", expectedAgeMonths: 2 },
    { milestone: "Stranger anxiety", expectedAgeMonths: 8 },
    { milestone: "Plays alongside others", expectedAgeMonths: 18 },
    { milestone: "Cooperative play", expectedAgeMonths: 36 },
  ],
  cognitive: [
    { milestone: "Follows objects with eyes", expectedAgeMonths: 2 },
    { milestone: "Object permanence", expectedAgeMonths: 8 },
    { milestone: "Points to objects", expectedAgeMonths: 12 },
    { milestone: "Sorts shapes/colors", expectedAgeMonths: 24 },
    { milestone: "Counts to 10", expectedAgeMonths: 48 },
  ],
};

const statusIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pending: { icon: Clock, color: "text-gray-400" },
  achieved: { icon: CheckCircle, color: "text-green-500" },
  delayed: { icon: AlertCircle, color: "text-yellow-500" },
  concern: { icon: AlertCircle, color: "text-red-500" },
};

export default function ChildInfoPage() {
  const [milestones, setMilestones] = useState<MilestoneView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    category: "motor" as MilestoneView["category"],
    milestone: "",
    expectedAgeMonths: "",
    notes: "",
  });

  const load = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [m, p] = await Promise.all([
      fetchMilestones(user.clinic_id, selectedPatient || undefined),
      fetchPatients(user.clinic_id),
    ]);
    setMilestones(m);
    setPatients(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    await createMilestone({
      clinic_id: user.clinic_id,
      patient_id: form.patientId,
      doctor_id: user.id,
      category: form.category,
      milestone: form.milestone,
      expected_age_months: parseInt(form.expectedAgeMonths) || undefined,
      notes: form.notes || undefined,
    });
    setShowAdd(false);
    setForm({ patientId: "", category: "motor", milestone: "", expectedAgeMonths: "", notes: "" });
    load();
  };

  const handlePopulateDefaults = async () => {
    if (!selectedPatient) return;
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const existing = milestones.filter((m) => m.patientId === selectedPatient);
    const existingKeys = new Set(existing.map((m) => `${m.category}:${m.milestone}`));

    for (const [category, templates] of Object.entries(MILESTONE_TEMPLATES)) {
      for (const t of templates) {
        const key = `${category}:${t.milestone}`;
        if (!existingKeys.has(key)) {
          await createMilestone({
            clinic_id: user.clinic_id,
            patient_id: selectedPatient,
            doctor_id: user.id,
            category,
            milestone: t.milestone,
            expected_age_months: t.expectedAgeMonths,
          });
        }
      }
    }
    load();
  };

  const handleStatusUpdate = async (id: string, status: MilestoneView["status"]) => {
    const updates: Record<string, unknown> = { status };
    if (status === "achieved") {
      updates.achieved_date = new Date().toISOString().split("T")[0];
    }
    await updateMilestone(id, updates);
    load();
  };

  if (loading) {
    return <PageLoader message="Loading child development data..." />;
  }

  const categories: MilestoneView["category"][] = ["motor", "language", "social", "cognitive"];
  const categoryLabels: Record<string, string> = {
    motor: "Motor Skills",
    language: "Language",
    social: "Social/Emotional",
    cognitive: "Cognitive",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Child Development & Milestones</h1>
        <div className="flex gap-2">
          {selectedPatient && (
            <Button variant="outline" onClick={handlePopulateDefaults}>
              Populate Defaults
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Milestone
          </Button>
        </div>
      </div>

      {/* Patient filter */}
      <div className="mb-6 max-w-xs">
        <Select value={selectedPatient} onValueChange={(v) => setSelectedPatient(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Select a patient" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {milestones.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Baby className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {selectedPatient
                ? "No milestones recorded. Click \"Populate Defaults\" to add standard milestones."
                : "Select a patient to view their developmental milestones."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="motor">
          <TabsList>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>{categoryLabels[cat]}</TabsTrigger>
            ))}
          </TabsList>
          {categories.map((cat) => {
            const catMilestones = milestones.filter((m) => m.category === cat);
            return (
              <TabsContent key={cat} value={cat}>
                <Card>
                  <CardContent className="pt-6">
                    {catMilestones.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No {categoryLabels[cat]} milestones recorded.</p>
                    ) : (
                      <div className="space-y-3">
                        {catMilestones.map((m) => {
                          const si = statusIcons[m.status];
                          const StatusIcon = si.icon;
                          return (
                            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                              <div className="flex items-center gap-3">
                                <StatusIcon className={`h-5 w-5 ${si.color}`} />
                                <div>
                                  <p className="text-sm font-medium">{m.milestone}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {m.patientName}
                                    {m.expectedAgeMonths !== null && ` · Expected: ${m.expectedAgeMonths}m`}
                                    {m.achievedDate && ` · Achieved: ${m.achievedDate}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  m.status === "achieved" ? "success" :
                                  m.status === "delayed" ? "warning" :
                                  m.status === "concern" ? "destructive" : "default"
                                }>
                                  {m.status}
                                </Badge>
                                {m.status !== "achieved" && (
                                  <Select
                                    value=""
                                    onValueChange={(v) => handleStatusUpdate(m.id, v as MilestoneView["status"])}
                                  >
                                    <SelectTrigger className="w-[120px] h-8 text-xs">
                                      <SelectValue placeholder="Update" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="achieved">Achieved</SelectItem>
                                      <SelectItem value="delayed">Delayed</SelectItem>
                                      <SelectItem value="concern">Concern</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Add Milestone Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Developmental Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={form.patientId} onValueChange={(v) => setForm((p) => ({ ...p, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as MilestoneView["category"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Milestone</Label>
              <Input value={form.milestone} onChange={(e) => setForm((p) => ({ ...p, milestone: e.target.value }))} placeholder="e.g., Walks independently" />
            </div>
            <div className="space-y-2">
              <Label>Expected Age (months)</Label>
              <Input type="number" min="0" value={form.expectedAgeMonths} onChange={(e) => setForm((p) => ({ ...p, expectedAgeMonths: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional observations..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.patientId || !form.milestone}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
