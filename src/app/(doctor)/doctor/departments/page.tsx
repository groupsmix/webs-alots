"use client";

import { useState, useEffect } from "react";
import { DepartmentDashboard } from "@/components/polyclinic/department-dashboard";
import { DepartmentManagement } from "@/components/polyclinic/department-management";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchDepartmentOverview, getCurrentUser } from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorDepartmentsPage() {
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
        logger.warn("Failed to load departments", { context: "doctor/departments", error: err });
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

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
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Departments" }]}
      />
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
          {/* Read-only for doctors — management is handled by clinic admin */}
          <DepartmentManagement departments={departments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
