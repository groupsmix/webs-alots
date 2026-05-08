"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ToothStatus, OdontogramEntry } from "@/lib/types/dental";

const STATUS_COLORS: Record<ToothStatus, string> = {
  healthy: "#22c55e",
  decayed: "#ef4444",
  filled: "#3b82f6",
  missing: "#9ca3af",
  crown: "#f59e0b",
  implant: "#8b5cf6",
  root_canal: "#f97316",
  extraction_needed: "#dc2626",
};

const STATUS_LABELS: Record<ToothStatus, string> = {
  healthy: "Healthy",
  decayed: "Decayed",
  filled: "Filled",
  missing: "Missing",
  crown: "Crown",
  implant: "Implant",
  root_canal: "Root Canal",
  extraction_needed: "Needs Extraction",
};

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

interface OdontogramChartProps {
  entries: OdontogramEntry[];
  editable?: boolean;
  onUpdateEntry?: (toothNumber: number, status: ToothStatus, notes: string) => void;
}

export function OdontogramChart({ entries, editable = false, onUpdateEntry }: OdontogramChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<ToothStatus>("healthy");
  const [editNotes, setEditNotes] = useState("");

  const getToothEntry = (num: number): OdontogramEntry | undefined =>
    entries.find((e) => e.toothNumber === num);

  const handleToothClick = (num: number) => {
    setSelectedTooth(num);
    const entry = getToothEntry(num);
    setEditStatus(entry?.status ?? "healthy");
    setEditNotes(entry?.notes ?? "");
  };

  const handleSave = () => {
    if (selectedTooth !== null && onUpdateEntry) {
      onUpdateEntry(selectedTooth, editStatus, editNotes);
      setSelectedTooth(null);
    }
  };

  const renderTooth = (num: number) => {
    const entry = getToothEntry(num);
    const status = entry?.status ?? "healthy";
    const isSelected = selectedTooth === num;
    const isMissing = status === "missing";

    return (
      <button
        key={num}
        onClick={() => handleToothClick(num)}
        className={`flex flex-col items-center gap-0.5 p-1 rounded transition-all ${
          isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted"
        }`}
        title={`Tooth #${num}: ${STATUS_LABELS[status]}`}
      >
        <svg width="24" height="28" viewBox="0 0 24 28">
          <rect
            x="2"
            y="2"
            width="20"
            height="24"
            rx="6"
            fill={isMissing ? "transparent" : STATUS_COLORS[status]}
            stroke={isMissing ? "#d1d5db" : STATUS_COLORS[status]}
            strokeWidth="2"
            strokeDasharray={isMissing ? "4 2" : "0"}
            opacity={isMissing ? 0.5 : 0.85}
          />
          {!isMissing && (
            <text x="12" y="18" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
              {num}
            </text>
          )}
          {isMissing && (
            <text x="12" y="18" textAnchor="middle" fill="#9ca3af" fontSize="9">
              {num}
            </text>
          )}
        </svg>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: STATUS_COLORS[key as ToothStatus] }} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Odontogram */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-xs text-muted-foreground text-center mb-2">Upper Jaw (Maxillary)</p>
        <div className="flex justify-center gap-0.5 flex-wrap">
          {UPPER_TEETH.map(renderTooth)}
        </div>
        <div className="border-t my-3" />
        <div className="flex justify-center gap-0.5 flex-wrap">
          {LOWER_TEETH.map(renderTooth)}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">Lower Jaw (Mandibular)</p>
      </div>

      {/* Selected Tooth Panel */}
      {selectedTooth !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Tooth #{selectedTooth}</span>
              <Badge
                style={{
                  backgroundColor: STATUS_COLORS[getToothEntry(selectedTooth)?.status ?? "healthy"],
                  color: "white",
                }}
              >
                {STATUS_LABELS[getToothEntry(selectedTooth)?.status ?? "healthy"]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editable ? (
              <div className="space-y-3">
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
                  <label className="text-xs text-muted-foreground block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ToothStatus)}
                    className="w-full rounded-lg border p-2 text-sm bg-background"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Treatment notes..."
                    className="text-sm"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedTooth(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {getToothEntry(selectedTooth)?.notes ? (
                  <p className="text-muted-foreground">{getToothEntry(selectedTooth)?.notes}</p>
                ) : (
                  <p className="text-muted-foreground italic">No notes</p>
                )}
                {getToothEntry(selectedTooth)?.lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {getToothEntry(selectedTooth)?.lastUpdated}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
