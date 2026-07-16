import { fetchPatientAcquisition } from "@/lib/data/patient-acquisition";
import { getLocaleFromTenant, requireTenant } from "@/lib/tenant";
import PatientAcquisitionClient from "./_patient-acquisition-client";

export default async function PatientAcquisitionPage() {
  const tenant = await requireTenant();
  const data = await fetchPatientAcquisition(tenant.clinicId);
  const locale = getLocaleFromTenant(tenant);

  return <PatientAcquisitionClient locale={locale} initialData={data} />;
}
