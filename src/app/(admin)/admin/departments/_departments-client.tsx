"use client";

import { useState } from "react";
import { DepartmentDashboard } from "@/components/polyclinic/department-dashboard";
import { DepartmentManagement } from "@/components/polyclinic/department-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { createClinicDepartment, setClinicDepartmentActive } from "@/lib/admin-actions";
import { fetchDepartmentOverview, type DepartmentOverviewView } from "@/lib/data/departments";
import { logger } from "@/lib/logger";

interface DepartmentsClientProps {
  clinicId: string;
  initialData: DepartmentOverviewView;
}

export default function DepartmentsClient({ clinicId, initialData }: DepartmentsClientProps) {
  const { addToast } = useToast();
  const [departments, setDepartments] = useState<DepartmentOverviewView["departments"]>(
    initialData.departments,
  );
  const [stats, setStats] = useState<DepartmentOverviewView["stats"]>(initialData.stats);

  async function reload() {
    const data = await fetchDepartmentOverview(clinicId);
    setDepartments(data.departments);
    setStats(data.stats);
  }

  async function handleAdd(department: {
    name: string;
    nameAr: string;
    floor: string;
    description: string;
  }) {
    try {
      await createClinicDepartment(department);
      await reload();
      addToast("Department created", "success");
    } catch (err) {
      logger.warn("Failed to create department", { context: "admin/departments", error: err });
      addToast("Failed to create department", "error");
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    const previous = departments;
    setDepartments((current) =>
      current.map((department) =>
        department.id === id ? { ...department, isActive: active } : department,
      ),
    );
    try {
      await setClinicDepartmentActive(id, active);
      await reload();
      addToast(active ? "Department activated" : "Department deactivated", "success");
    } catch (err) {
      logger.warn("Failed to update department", { context: "admin/departments", error: err });
      setDepartments(previous);
      addToast("Failed to update department", "error");
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Departments" }]}
      />
      <h1 className="text-2xl font-bold">Department Management</h1>
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4">
          <DepartmentManagement
            departments={departments}
            editable
            onAdd={handleAdd}
            onToggleActive={handleToggleActive}
          />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <DepartmentDashboard stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
