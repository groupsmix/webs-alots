import { AdminAgendaView } from "@/components/admin/admin-agenda-view";
import { getAdminAgendaAppointments } from "@/lib/data/admin-agenda";
import { requireTenantWithConfig } from "@/lib/tenant";
import { getLocalDateStr } from "@/lib/utils";

export default async function AdminAgendaPage() {
  const { tenant, config } = await requireTenantWithConfig();
  const today = getLocalDateStr(new Date(), config.timezone);
  const appointments = await getAdminAgendaAppointments(tenant.clinicId, today, config.timezone);

  return <AdminAgendaView appointments={appointments} today={today} timezone={config.timezone} />;
}
