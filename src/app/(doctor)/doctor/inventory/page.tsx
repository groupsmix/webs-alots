import { InventoryManager } from "@/components/doctor/inventory-manager";
import { requireRole } from "@/lib/auth";

export default async function InventoryPage() {
  await requireRole("doctor", "clinic_admin");
  return (
    <div className="mx-auto max-w-5xl p-4">
      <InventoryManager />
    </div>
  );
}
