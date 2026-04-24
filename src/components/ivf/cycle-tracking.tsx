"use client";

import { useState } from "react";
import { HeartHandshake, Plus, Calendar, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IVFCycleStatus, IVFCycleType, IVFOutcome } from "@/lib/types/database";

interface CycleView {
  id: string;
  patientName: string;
  partnerName: string | null;
  doctorName: string | null;
  cycleNumber: number;
  cycleType: IVFCycleType;
  status: IVFCycleStatus;
  startDate: string | null;
  retrievalDate: string | null;
  transferDate: string | null;
  eggsRetrieved: number | null;
  eggsFertilized: number | null;
  embryosTransferred: number | null;
  embryosFrozen: number | null;
  outcome: IVFOutcome | null;
  betaHcgValue: number | null;
  notes: string | null;
}

const STATUS_ORDER: IVFCycleStatus[] = ["planned", "stimulation", "retrieval", "fertilization", "transfer", "tww", "completed", "cancelled"];

const STATUS_COLORS: Record<IVFCycleStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  stimulation: "bg-blue-100 text-blue-700",
  retrieval: "bg-purple-100 text-purple-700",
  fertilization: "bg-pink-100 text-pink-700",
  transfer: "bg-orange-100 text-orange-700",
  tww: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const CYCLE_TYPE_LABELS: Record<IVFCycleType, string> = {
  ivf: "IVF",
  icsi: "ICSI",
  iui: "IUI",
  fet: "FET",
  egg_freezing: "Egg Freezing",
  other: "Other",
};

const OUTCOME_VARIANTS: Record<string, "default" | "success" | "destructive" | "secondary" | "warning"> = {
  positive: "success",
  negative: "destructive",
  biochemical: "warning",
  miscarriage: "destructive",
  ongoing: "default",
  pending: "secondary",
};

interface CycleTrackingProps {
  cycles: CycleView[];
  editable?: boolean;
  onAddCycle?: (cycle: { patientName: string; cycleType: IVFCycleType; startDate: string }) => void;
  onAdvanceStatus?: (cycleId: string, newStatus: IVFCycleStatus) => void;
  onUpdateOutcome?: (cycleId: string, outcome: IVFOutcome) => void;
}

export function CycleTracking({ cycles, editable = false, onAddCycle, onAdvanceStatus, onUpdateOutcome }: CycleTrackingProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientName: "", cycleType: "ivf" as IVFCycleType, startDate: "" });

  const handleAdd = () => {
    if (form.patientName.trim() && onAddCycle) {
      onAddCycle(form);
      setForm({ patientName: "", cycleType: "ivf", startDate: "" });
      setShowForm(false);
    }
  };

  const getNextStatus = (current: IVFCycleStatus): IVFCycleStatus | null => {
    if (current === "completed" || current === "cancelled") return null;
    const idx = STATUS_ORDER.indexOf(current);
    return idx < STATUS_ORDER.length - 2 ? STATUS_ORDER[idx + 1] : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HeartHandshake className="h-5 w-5" />
          IVF Cycle Tracking
          <Badge variant="secondary" className="ml-1">{cycles.length}</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            New Cycle
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New IVF Cycle</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Patient Name</Label>
                <Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} placeholder="Patient" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Cycle Type</Label>
                <select value={form.cycleType} onChange={(e) => setForm({ ...form, cycleType: e.target.value as IVFCycleType })} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.entries(CYCLE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Start Cycle</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <HeartHandshake className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No IVF cycles recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const nextStatus = getNextStatus(cycle.status);
            return (
              <Card key={cycle.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{cycle.patientName}</p>
                        <Badge variant="outline" className="text-[10px]">{CYCLE_TYPE_LABELS[cycle.cycleType]}</Badge>
                        <Badge variant="outline" className="text-[10px]">Cycle #{cycle.cycleNumber}</Badge>
                      </div>
                      {cycle.partnerName && <p className="text-xs text-muted-foreground">Partner: {cycle.partnerName}</p>}
                      {cycle.doctorName && <p className="text-xs text-muted-foreground">Dr. {cycle.doctorName}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${STATUS_COLORS[cycle.status]}`}>
                        {cycle.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      {cycle.outcome && (
                        <Badge variant={OUTCOME_VARIANTS[cycle.outcome]} className="text-xs">
                          {cycle.outcome === "positive" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {cycle.outcome === "negative" && <XCircle className="h-3 w-3 mr-1" />}
                          {cycle.outcome}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Timeline Progress */}
                  <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                    {STATUS_ORDER.filter(s => s !== "cancelled").map((step, idx) => {
                      const stepIdx = STATUS_ORDER.indexOf(cycle.status);
                      const thisIdx = STATUS_ORDER.indexOf(step);
                      const isPast = thisIdx < stepIdx;
                      const isCurrent = step === cycle.status;
                      return (
                        <div key={step} className="flex items-center">
                          <div className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap ${isCurrent ? STATUS_COLORS[step] + " font-medium" : isPast ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground"}`}>
                            {step.replace("_", " ")}
                          </div>
                          {idx < 6 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-0.5 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Key Dates & Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    {cycle.startDate && (
                      <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Start: {cycle.startDate}</div>
                    )}
                    {cycle.retrievalDate && <div>Retrieval: {cycle.retrievalDate}</div>}
                    {cycle.transferDate && <div>Transfer: {cycle.transferDate}</div>}
                    {cycle.eggsRetrieved !== null && <div>Eggs: {cycle.eggsRetrieved}</div>}
                    {cycle.eggsFertilized !== null && <div>Fertilized: {cycle.eggsFertilized}</div>}
                    {cycle.embryosTransferred !== null && <div>Transferred: {cycle.embryosTransferred}</div>}
                    {cycle.embryosFrozen !== null && <div>Frozen: {cycle.embryosFrozen}</div>}
                    {cycle.betaHcgValue !== null && <div>Beta HCG: {cycle.betaHcgValue}</div>}
                  </div>

                  {editable && nextStatus && (
                    <div className="mt-3 flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => onAdvanceStatus?.(cycle.id, nextStatus)}>
                        Advance to {nextStatus.replace("_", " ")}
                      </Button>
                      {cycle.status === "tww" && (
                        <>
                          <Button size="sm" variant="default" className="text-xs" onClick={() => onUpdateOutcome?.(cycle.id, "positive")}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Positive
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => onUpdateOutcome?.(cycle.id, "negative")}>
                            <XCircle className="h-3 w-3 mr-1" /> Negative
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
