"use client";

import { useState, useEffect } from "react";
import { MachineManagement } from "@/components/dialysis/machine-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { fetchDialysisMachines, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorDialysisMachinesPage() {
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
        logger.warn("Failed to load dialysis machines", {
          context: "doctor/dialysis-machines",
          error: err,
        });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  if (loading) return <PageLoader message="Loading dialysis machines..." />;

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
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Dialysis Machines" }]}
      />
      <h1 className="text-2xl font-bold">Dialysis Machines</h1>
      {/* Read-only view for doctors — status management is handled by clinic admin */}
      <MachineManagement machines={machines} />
    </div>
  );
}
