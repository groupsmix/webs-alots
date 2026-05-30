import { PatientFinanceView } from "@/components/doctor/patient-finance-view";
import { requireRole } from "@/lib/auth";

export default async function PatientFinancePage() {
  await requireRole("doctor", "clinic_admin", "receptionist");
  return (
    <div className="mx-auto max-w-4xl p-4">
      <PatientFinanceView />
    </div>
  );
}
