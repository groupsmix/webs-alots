"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Wrench, ChevronDown, CalendarClock } from "lucide-react";
import { clinicConfig } from "@/config/clinic.config";
import { fetchEquipmentMaintenance } from "@/lib/data/client";
import type { EquipmentMaintenanceView } from "@/lib/data/client";

const statusOptions = ["all", "scheduled", "in_progress", "completed", "cancelled"] as const;

const statusColors: Record<string, string> = {
  scheduled: "bg-cyan-100 text-cyan-700 border-0",
  in_progress: "bg-blue-100 text-blue-700 border-0",
  completed: "bg-emerald-100 text-emerald-700 border-0",
  cancelled: "bg-gray-100 text-gray-700 border-0",
};

const typeColors: Record<string, string> = {
  routine: "bg-blue-100 text-blue-700 border-0",
  repair: "bg-orange-100 text-orange-700 border-0",
  calibration: "bg-purple-100 text-purple-700 border-0",
  inspection: "bg-cyan-100 text-cyan-700 border-0",
  cleaning: "bg-emerald-100 text-emerald-700 border-0",
};

export default function EquipmentMaintenancePage() {
  const [records, setRecords] = useState<EquipmentMaintenanceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipmentMaintenance(clinicConfig.clinicId)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading maintenance records...</div>
      </div>
    );
  }

  const filtered = records.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.equipmentName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || (r.performedBy?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  // Upcoming maintenance alerts (scheduled, with nextDue in next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const upcoming = records.filter((r) => {
    if (r.status !== "scheduled") return false;
    if (!r.nextDue) return false;
    const due = new Date(r.nextDue);
    return due <= thirtyDaysFromNow;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground text-sm">{records.length} maintenance records</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <Card className="mb-6 border-orange-200 dark:border-orange-900">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-sm">Upcoming Maintenance ({upcoming.length})</h3>
            </div>
            <div className="space-y-2">
              {upcoming.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/10 rounded">
                  <div>
                    <p className="font-medium text-sm">{m.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">{m.type} &middot; Due: {m.nextDue ? new Date(m.nextDue).toLocaleDateString() : "—"}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-0 text-xs capitalize">{m.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by equipment, type, technician..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
              {s === "all" ? "All" : s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((record) => (
          <Card key={record.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">{record.equipmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.performedAt).toLocaleDateString()} &middot; {record.performedBy ?? "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={typeColors[record.type] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {record.type}
                  </Badge>
                  <Badge className={statusColors[record.status] ?? "bg-gray-100 text-gray-700 border-0"}>
                    {record.status.replace("_", " ")}
                  </Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === record.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === record.id && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Type</p>
                      <p className="font-medium capitalize">{record.type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Performed By</p>
                      <p className="font-medium">{record.performedBy ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cost</p>
                      <p className="font-medium">{record.cost != null ? `${record.cost} ${record.currency}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Next Due</p>
                      <p className="font-medium">{record.nextDue ? new Date(record.nextDue).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                  {record.description && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">Description</p>
                      <p>{record.description}</p>
                    </div>
                  )}
                  {record.notes && (
                    <div className="text-sm mt-3">
                      <p className="text-muted-foreground text-xs">Notes</p>
                      <p>{record.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No maintenance records match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
