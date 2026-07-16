import { fetchDepartmentOverview } from "@/lib/data/departments";
import { requireTenant } from "@/lib/tenant";
import DepartmentsClient from "./_departments-client";

export default async function AdminDepartmentsPage() {
  const tenant = await requireTenant();
  const data = await fetchDepartmentOverview(tenant.clinicId);

  return <DepartmentsClient clinicId={tenant.clinicId} initialData={data} />;
}
