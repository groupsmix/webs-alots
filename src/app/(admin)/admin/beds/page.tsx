import { fetchBedManagementRooms } from "@/lib/data/beds";
import { requireTenant } from "@/lib/tenant";
import BedsClient from "./_beds-client";

export default async function AdminBedsPage() {
  const tenant = await requireTenant();
  const rooms = await fetchBedManagementRooms(tenant.clinicId);

  return <BedsClient clinicId={tenant.clinicId} initialRooms={rooms} />;
}
