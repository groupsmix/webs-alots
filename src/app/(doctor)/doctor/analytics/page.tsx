import dynamic from "next/dynamic";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";

const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/analytics-dashboard").then((m) => m.AnalyticsDashboard),
  { loading: () => <PageLoader message="Loading analytics..." /> },
);

export default function DoctorAnalyticsPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Analytics" }]} />
      <AnalyticsDashboard role="doctor" />
    </>
  );
}
