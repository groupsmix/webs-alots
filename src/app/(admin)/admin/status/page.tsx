import { fetchHealth } from "@/lib/data/health";
import StatusDashboard from "./_status-dashboard";

export default async function AdminStatusPage() {
  let initialHealth: Awaited<ReturnType<typeof fetchHealth>> | null = null;
  try {
    initialHealth = await fetchHealth();
  } catch {
    initialHealth = null;
  }

  return <StatusDashboard initialHealth={initialHealth} />;
}
