"use client";

import { useEffect, useState } from "react";
import { MachineManagement } from "@/components/dialysis/machine-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  createClinicDialysisMachine,
  updateClinicDialysisMachineStatus,
} from "@/lib/admin-actions";
import { fetchDialysisMachines, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { DialysisMachineStatus } from "@/lib/types/database";

export default function AdminMachinesPage() {
  const { addToast } = useToast();
  const [machines, setMachines] = useState<Parameters<typeof MachineManagement>[0]["machines"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      const data = await fetchDialysisMachines(user.clinic_id);
      if (controller.signal.aborted) return;
      setMachines(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleAdd(machine: {
    machineName: string;
    machineModel: string;
    serialNumber: string;
  }) {
    try {
      await createClinicDialysisMachine(machine);
      const user = await getCurrentUser();
      if (user?.clinic_id) setMachines(await fetchDialysisMachines(user.clinic_id));
      addToast("Machine added", "success");
    } catch (err) {
      logger.warn("Failed to add dialysis machine", { context: "admin/machines", error: err });
      addToast("Failed to add machine", "error");
    }
  }

  async function handleUpdateStatus(machineId: string, status: DialysisMachineStatus) {
    const previous = machines;
    setMachines((current) =>
      current.map((machine) => (machine.id === machineId ? { ...machine, status } : machine)),
    );
    try {
      await updateClinicDialysisMachineStatus(machineId, status);
      addToast("Machine status updated", "success");
    } catch (err) {
      logger.warn("Failed to update machine status", {
        context: "admin/machines",
        error: err,
      });
      setMachines(previous);
      addToast("Failed to update machine status", "error");
    }
  }

  if (loading) return <PageLoader message="Loading machines..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load dialysis machines.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Machines" }]} />
      <h1 className="text-2xl font-bold">Dialysis Machines</h1>
      <MachineManagement
        machines={machines}
        editable
        onAdd={handleAdd}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
