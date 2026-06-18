"use client";

import { useEffect, useState } from "react";
import { DepartmentDashboard } from "@/components/polyclinic/department-dashboard";
import { DepartmentManagement } from "@/components/polyclinic/department-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { createClinicDepartment, setClinicDepartmentActive } from "@/lib/admin-actions";
import { fetchDepartmentOverview, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function AdminDepartmentsPage() {
  const { addToast } = useToast();
  const [departments, setDepartments] = useState<
    Parameters<typeof DepartmentManagement>[0]["departments"]
  >([]);
  const [stats, setStats] = useState<Parameters<typeof DepartmentDashboard>[0]["stats"]>([]);
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
      const data = await fetchDepartmentOverview(user.clinic_id);
      if (controller.signal.aborted) return;
      setDepartments(data.departments);
      setStats(data.stats);
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

  async function reloadData() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;
    const data = await fetchDepartmentOverview(user.clinic_id);
    setDepartments(data.departments);
    setStats(data.stats);
  }

  async function handleAddDepartment(department: {
    name: string;
    nameAr: string;
    floor: string;
    description: string;
  }) {
    try {
      await createClinicDepartment(department);
      await reloadData();
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
      addToast(active ? "Department activated" : "Department deactivated", "success");
    } catch (err) {
      logger.warn("Failed to update department", { context: "admin/departments", error: err });
      setDepartments(previous);
      addToast("Failed to update department", "error");
    }
  }

  if (loading) return <PageLoader message="Loading departments..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load department data.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
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
            onAdd={handleAddDepartment}
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
