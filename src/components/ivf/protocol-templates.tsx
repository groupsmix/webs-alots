"use client";

import { ClipboardList, Plus, Pill, Clock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IVFProtocolType } from "@/lib/types/database";

interface ProtocolView {
  id: string;
  name: string;
  description: string | null;
  protocolType: IVFProtocolType;
  medications: { name: string; dosage: string; startDay: number; endDay: number }[];
  steps: { day: number; description: string }[];
  durationDays: number | null;
}

const TYPE_LABELS: Record<IVFProtocolType, string> = {
  long: "Long Protocol",
  short: "Short Protocol",
  antagonist: "Antagonist",
  natural: "Natural Cycle",
  mini_ivf: "Mini IVF",
  custom: "Custom",
};

interface ProtocolTemplatesProps {
  protocols: ProtocolView[];
  editable?: boolean;
  onAdd?: (protocol: { name: string; protocolType: IVFProtocolType; description: string; durationDays: number }) => void;
}

export function ProtocolTemplates({ protocols, editable = false, onAdd }: ProtocolTemplatesProps) {
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", protocolType: "antagonist" as IVFProtocolType, description: "", durationDays: "14" });

  const handleAdd = () => {
    if (form.name.trim() && onAdd) {
      onAdd({ ...form, durationDays: parseInt(form.durationDays) || 14 });
      setForm({ name: "", protocolType: "antagonist", description: "", durationDays: "14" });
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Protocol Templates
          <Badge variant="secondary" className="ml-1">{protocols.length}</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            New Protocol
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Protocol Template</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Protocol Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard Antagonist" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <select value={form.protocolType} onChange={(e) => setForm({ ...form, protocolType: e.target.value as IVFProtocolType })} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Duration (days)</Label>
                <Input type="number" min="1" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Protocol description and notes..." className="text-sm" rows={2} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Create Protocol</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {protocols.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No protocol templates defined.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {protocols.map((protocol) => (
            <Card key={protocol.id} className="cursor-pointer" onClick={() => setExpanded(expanded === protocol.id ? null : protocol.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{protocol.name}</p>
                    {protocol.description && <p className="text-xs text-muted-foreground mt-0.5">{protocol.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[protocol.protocolType]}</Badge>
                    {protocol.durationDays && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Clock className="h-2.5 w-2.5 mr-0.5" /> {protocol.durationDays}d
                      </Badge>
                    )}
                  </div>
                </div>

                {expanded === protocol.id && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    {protocol.medications.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1 flex items-center gap-1"><Pill className="h-3 w-3" /> Medications</p>
                        <div className="space-y-1">
                          {protocol.medications.map((med, i) => (
                            <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="font-medium">{med.name}</span>
                              <span>{med.dosage}</span>
                              <span className="text-[10px]">Day {med.startDay}–{med.endDay}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {protocol.steps.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Steps</p>
                        <div className="space-y-1">
                          {protocol.steps.map((step, i) => (
                            <div key={i} className="text-xs text-muted-foreground">
                              <span className="font-medium">Day {step.day}:</span> {step.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
