"use client";

import { ShieldCheck, Plus, AlertTriangle, Clock } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SterilizationEntry } from "@/lib/types/dental";
import { formatCurrency, formatNumber, formatDisplayDate } from "@/lib/utils";

interface SterilizationLogPanelProps {
  entries: SterilizationEntry[];
  onAddEntry?: (entry: Omit<SterilizationEntry, "id" | "sterilizedAt">) => void;
}

export function SterilizationLogPanel({ entries, onAddEntry }: SterilizationLogPanelProps) {
  const [locale] = useLocale();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    toolName: "",
    sterilizedBy: "",
    method: "autoclave" as SterilizationEntry["method"],
    notes: "",
  });

  const now = new Date();

  const isOverdue = (nextDue: string | null) => {
    if (!nextDue) return false;
    return new Date(nextDue) < now;
  };

  const handleAdd = () => {
    if (newEntry.toolName.trim() && onAddEntry) {
      onAddEntry({
        toolName: newEntry.toolName,
        sterilizedBy: newEntry.sterilizedBy,
        method: newEntry.method,
        notes: newEntry.notes,
        nextDue: null,
      });
      setNewEntry({ toolName: "", sterilizedBy: "", method: "autoclave", notes: "" });
      setShowAddForm(false);
    }
  };

  const overdueCount = entries.filter((e) => isOverdue(e.nextDue)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {overdueCount} overdue
            </Badge>
          )}
        </div>
        {onAddEntry && (
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Log Sterilization
          </Button>
        )}
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Log New Sterilization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tool / Instrument</Label>
                <Input
                  value={newEntry.toolName}
                  onChange={(e) => setNewEntry({ ...newEntry, toolName: e.target.value })}
                  placeholder="Dental Handpiece Set"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Sterilized By</Label>
                <Input
                  value={newEntry.sterilizedBy}
                  onChange={(e) => setNewEntry({ ...newEntry, sterilizedBy: e.target.value })}
                  placeholder="Assistant name"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Method</Label>
                <select
                  value={newEntry.method}
                  onChange={(e) => setNewEntry({ ...newEntry, method: e.target.value as SterilizationEntry["method"] })}
                  className="w-full rounded-lg border p-2 text-sm bg-background"
                >
                  <option value="autoclave">Autoclave</option>
                  <option value="chemical">Chemical</option>
                  <option value="dry_heat">Dry Heat</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  placeholder="Cycle details..."
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Log Entry</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const overdue = isOverdue(entry.nextDue);
          return (
            <Card key={entry.id} className={overdue ? "border-red-300 dark:border-red-800" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className={`h-5 w-5 mt-0.5 ${overdue ? "text-red-500" : "text-green-600"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{entry.toolName}</p>
                      <Badge
                        variant={overdue ? "destructive" : "outline"}
                        className="text-xs shrink-0"
                      >
                        {entry.method.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>By: {entry.sterilizedBy} &middot; {formatDisplayDate(new Date(entry.sterilizedAt), typeof locale !== "undefined" ? locale : "fr", "datetime")}</p>
                      {entry.nextDue && (
                        <p className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : ""}`}>
                          <Clock className="h-3 w-3" />
                          Next due: {formatDisplayDate(new Date(entry.nextDue), typeof locale !== "undefined" ? locale : "fr", "datetime")}
                        </p>
                      )}
                      {entry.notes && <p className="italic">{entry.notes}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
