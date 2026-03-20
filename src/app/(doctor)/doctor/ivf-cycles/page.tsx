"use client";

import { useState } from "react";
import { CycleTracking } from "@/components/ivf/cycle-tracking";
import { OutcomeStatistics } from "@/components/ivf/outcome-statistics";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function DoctorIVFCyclesPage() {
  const [cycles] = useState<Parameters<typeof CycleTracking>[0]["cycles"]>([]);

  const emptyStats: Parameters<typeof OutcomeStatistics>[0]["stats"] = {
    totalCycles: 0, completedCycles: 0, positiveCycles: 0,
    negativeCycles: 0, ongoingCycles: 0, cancelledCycles: 0,
    averageEggsRetrieved: 0, averageEggsFertilized: 0,
    averageEmbryosTransferred: 0, successRatePercent: 0,
    cyclesByType: [], monthlyOutcomes: [],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">IVF Cycle Management</h1>
      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles" className="mt-4">
          <CycleTracking cycles={cycles} editable />
        </TabsContent>
        <TabsContent value="statistics" className="mt-4">
          <OutcomeStatistics stats={emptyStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
