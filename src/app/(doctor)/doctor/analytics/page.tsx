import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/page-loader";

const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/analytics-dashboard").then((m) => m.AnalyticsDashboard),
  { loading: () => <PageLoader message="Loading analytics..." /> },
);

export default function DoctorAnalyticsPage() {
  return <AnalyticsDashboard role="doctor" />;
}
