"use client";

import { useState } from "react";
import { DepartmentDashboard } from "@/components/polyclinic/department-dashboard";
import { DepartmentManagement } from "@/components/polyclinic/department-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminDepartmentsPage() {
  const [departments] = useState<Parameters<typeof DepartmentManagement>[0]["departments"]>([]);
  const [stats] = useState<Parameters<typeof DepartmentDashboard>[0]["stats"]>([]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Departments" }]} />
      <h1 className="text-2xl font-bold">Department Management</h1>
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4">
          <DepartmentManagement departments={departments} editable />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <DepartmentDashboard stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
