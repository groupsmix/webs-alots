"use client";

import { Monitor, Plus, Wrench, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DialysisMachineStatus } from "@/lib/types/database";

interface MachineView {
  id: string;
  machineName: string;
  machineModel: string | null;
  serialNumber: string | null;
  status: DialysisMachineStatus;
  lastMaintenance: string | null;
  nextMaintenance: string | null;
  currentPatientName: string | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<DialysisMachineStatus, { icon: typeof CheckCircle; color: string; bgColor: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  available: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100", variant: "success" },
  in_use: { icon: Monitor, color: "text-blue-600", bgColor: "bg-blue-100", variant: "default" },
  maintenance: { icon: Wrench, color: "text-yellow-600", bgColor: "bg-yellow-100", variant: "warning" },
  out_of_service: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", variant: "destructive" },
};

interface MachineManagementProps {
  machines: MachineView[];
  editable?: boolean;
  onAdd?: (machine: { machineName: string; machineModel: string; serialNumber: string }) => void;
  onUpdateStatus?: (machineId: string, status: DialysisMachineStatus) => void;
}

export function MachineManagement({ machines, editable = false, onAdd, onUpdateStatus }: MachineManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ machineName: "", machineModel: "", serialNumber: "" });

  const handleAdd = () => {
    if (form.machineName.trim() && onAdd) {
      onAdd(form);
      setForm({ machineName: "", machineModel: "", serialNumber: "" });
      setShowForm(false);
    }
  };

  const available = machines.filter((m) => m.status === "available").length;
  const inUse = machines.filter((m) => m.status === "in_use").length;
  const maintenance = machines.filter((m) => m.status === "maintenance").length;

  const sevenDaysFromNow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Dialysis Machines
          <Badge variant="secondary" className="ml-1">{machines.length}</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Machine
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-green-600">{available}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{inUse}</p>
            <p className="text-xs text-muted-foreground">In Use</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-yellow-600">{maintenance}</p>
            <p className="text-xs text-muted-foreground">Maintenance</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Add Machine</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Machine Name</Label>
                <Input value={form.machineName} onChange={(e) => setForm({ ...form, machineName: e.target.value })} placeholder="Machine A1" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Model</Label>
                <Input value={form.machineModel} onChange={(e) => setForm({ ...form, machineModel: e.target.value })} placeholder="Fresenius 5008S" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Serial Number</Label>
                <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-12345" className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Machine Grid */}
      {machines.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Monitor className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No machines registered.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {machines.map((machine) => {
            const config = STATUS_CONFIG[machine.status];
            const StatusIcon = config.icon;
            const maintenanceSoon = machine.nextMaintenance && new Date(machine.nextMaintenance) <= sevenDaysFromNow;

            return (
              <Card key={machine.id}>
                <CardContent className="p-3">
                  <div className={`flex items-center justify-center h-12 rounded-lg mb-2 ${config.bgColor}`}>
                    <StatusIcon className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <p className="text-sm font-medium text-center">{machine.machineName}</p>
                  {machine.machineModel && <p className="text-[10px] text-muted-foreground text-center">{machine.machineModel}</p>}
                  <div className="flex justify-center mt-1">
                    <Badge variant={config.variant} className="text-[10px]">{machine.status.replace("_", " ")}</Badge>
                  </div>
                  {machine.currentPatientName && (
                    <p className="text-[10px] text-center mt-1 text-muted-foreground">{machine.currentPatientName}</p>
                  )}
                  {maintenanceSoon && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      <span className="text-[10px] text-yellow-600">Maintenance soon</span>
                    </div>
                  )}
                  {editable && (
                    <div className="mt-2 flex gap-1 justify-center">
                      {machine.status === "available" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => onUpdateStatus?.(machine.id, "maintenance")}>
                          <Wrench className="h-2.5 w-2.5 mr-0.5" /> Maintenance
                        </Button>
                      )}
                      {machine.status === "maintenance" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => onUpdateStatus?.(machine.id, "available")}>
                          <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Ready
                        </Button>
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
