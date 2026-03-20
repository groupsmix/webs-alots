"use client";

import { useState } from "react";
import { DepartmentManagement } from "@/components/polyclinic/department-management";
import { DepartmentDashboard } from "@/components/polyclinic/department-dashboard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function DoctorDepartmentsPage() {
  const [departments] = useState<Parameters<typeof DepartmentManagement>[0]["departments"]>([]);
  const [stats] = useState<Parameters<typeof DepartmentDashboard>[0]["stats"]>([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Departments</h1>
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="departments">All Departments</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <DepartmentDashboard stats={stats} />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <DepartmentManagement departments={departments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
