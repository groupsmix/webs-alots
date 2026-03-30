"use client";

import { useState } from "react";
import { SessionScheduler } from "@/components/dialysis/session-scheduler";
import { VitalsTracker } from "@/components/dialysis/vitals-tracker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function DoctorDialysisSessionsPage() {
  const [sessions] = useState<Parameters<typeof SessionScheduler>[0]["sessions"]>([]);
  const [vitals] = useState<Parameters<typeof VitalsTracker>[0]["sessions"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Dialysis Sessions" }]} />
      <h1 className="text-2xl font-bold">Dialysis Sessions</h1>
      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4">
          <SessionScheduler sessions={sessions} editable />
        </TabsContent>
        <TabsContent value="vitals" className="mt-4">
          <VitalsTracker sessions={vitals} editable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
