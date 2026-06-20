"use client";

import { useState, useEffect, useMemo } from "react";
import { CycleTracking } from "@/components/ivf/cycle-tracking";
import { OutcomeStatistics } from "@/components/ivf/outcome-statistics";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchIVFCycles,
  fetchPatients,
  createIVFCycle,
  updateIVFCycleStatus,
  updateIVFCycleOutcome,
  type IVFCycleView,
  type PatientView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";
import type { IVFCycleStatus, IVFCycleType, IVFOutcome } from "@/lib/types/database";

function computeIVFStats(cycles: IVFCycleView[]) {
  const completed = cycles.filter((c) => c.status === "completed");
  const positive = cycles.filter((c) => c.outcome === "positive");
  const negative = cycles.filter((c) => c.outcome === "negative");
  const ongoing = cycles.filter((c) => !["completed", "cancelled"].includes(c.status));
  const cancelled = cycles.filter((c) => c.status === "cancelled");

  const avg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : 0;

  const cycleTypeMap = new Map<string, { count: number; positiveCount: number }>();
  for (const c of cycles) {
    const e = cycleTypeMap.get(c.cycleType) ?? { count: 0, positiveCount: 0 };
    e.count++;
    if (c.outcome === "positive") e.positiveCount++;
    cycleTypeMap.set(c.cycleType, e);
  }

  return {
    totalCycles: cycles.length,
    completedCycles: completed.length,
    positiveCycles: positive.length,
    negativeCycles: negative.length,
    ongoingCycles: ongoing.length,
    cancelledCycles: cancelled.length,
    averageEggsRetrieved: avg(
      completed.filter((c) => c.eggsRetrieved !== null).map((c) => c.eggsRetrieved!),
    ),
    averageEggsFertilized: avg(
      completed.filter((c) => c.eggsFertilized !== null).map((c) => c.eggsFertilized!),
    ),
    averageEmbryosTransferred: avg(
      completed.filter((c) => c.embryosTransferred !== null).map((c) => c.embryosTransferred!),
    ),
    successRatePercent:
      completed.length > 0 ? Math.round((positive.length / completed.length) * 1000) / 10 : 0,
    cyclesByType: [...cycleTypeMap.entries()].map(([type, d]) => ({ type, ...d })),
    monthlyOutcomes: [] as { month: string; total: number; positive: number; negative: number }[],
  };
}

export default function DoctorIVFCyclesPage() {
  const { addToast } = useToast();
  const [cycles, setCycles] = useState<IVFCycleView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
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
      setClinicId(user.clinic_id);
      const [cyc, pats] = await Promise.all([
        fetchIVFCycles(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setCycles(cyc);
      setPatients(pats);
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

  const stats = useMemo(() => computeIVFStats(cycles), [cycles]);

  async function handleAddCycle(data: {
    patientName: string;
    cycleType: IVFCycleType;
    startDate: string;
  }) {
    if (!clinicId) return;
    const patient = patients.find(
      (p) => p.name.toLowerCase() === data.patientName.toLowerCase().trim(),
    );
    if (!patient) {
      addToast("Patient not found. Enter the exact patient name.", "error");
      return;
    }
    try {
      const { id } = await createIVFCycle(clinicId, patient.id, {
        cycleType: data.cycleType,
        startDate: data.startDate,
      });
      const cycleCount = cycles.filter((c) => c.patientId === patient.id).length;
      setCycles((prev) => [
        {
          id,
          patientId: patient.id,
          patientName: patient.name,
          partnerName: null,
          doctorName: null,
          cycleNumber: cycleCount + 1,
          cycleType: data.cycleType,
          status: "planned" as IVFCycleStatus,
          startDate: data.startDate || null,
          retrievalDate: null,
          transferDate: null,
          eggsRetrieved: null,
          eggsFertilized: null,
          embryosTransferred: null,
          embryosFrozen: null,
          outcome: null,
          betaHcgValue: null,
          notes: null,
        },
        ...prev,
      ]);
      addToast("IVF cycle started", "success");
    } catch (err) {
      logger.warn("Failed to create IVF cycle", { context: "doctor/ivf-cycles", error: err });
      addToast("Failed to create cycle. Please try again.", "error");
    }
  }

  async function handleAdvanceStatus(cycleId: string, newStatus: IVFCycleStatus) {
    if (!clinicId) return;
    const previous = cycles;
    setCycles((prev) => prev.map((c) => (c.id === cycleId ? { ...c, status: newStatus } : c)));
    try {
      await updateIVFCycleStatus(clinicId, cycleId, newStatus);
    } catch (err) {
      logger.warn("Failed to advance cycle status", { context: "doctor/ivf-cycles", error: err });
      setCycles(previous);
      addToast("Failed to update cycle status.", "error");
    }
  }

  async function handleUpdateOutcome(cycleId: string, outcome: IVFOutcome) {
    if (!clinicId) return;
    const previous = cycles;
    setCycles((prev) =>
      prev.map((c) =>
        c.id === cycleId ? { ...c, outcome, status: "completed" as IVFCycleStatus } : c,
      ),
    );
    try {
      await updateIVFCycleOutcome(clinicId, cycleId, outcome);
      addToast(`Cycle outcome recorded: ${outcome}`, "success");
    } catch (err) {
      logger.warn("Failed to update cycle outcome", { context: "doctor/ivf-cycles", error: err });
      setCycles(previous);
      addToast("Failed to record outcome.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading IVF cycles..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load IVF cycles.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "IVF Cycles" }]}
      />
      <h1 className="text-2xl font-bold">IVF Cycle Management</h1>
      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles" className="mt-4">
          <CycleTracking
            cycles={cycles}
            editable
            onAddCycle={handleAddCycle}
            onAdvanceStatus={handleAdvanceStatus}
            onUpdateOutcome={handleUpdateOutcome}
          />
        </TabsContent>
        <TabsContent value="statistics" className="mt-4">
          <OutcomeStatistics stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
