import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/page-loader";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/analytics-dashboard").then((m) => m.AnalyticsDashboard),
  { loading: () => <PageLoader message="Loading analytics..." /> },
);

export default function ReportsPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Reports" }]} />
      <AnalyticsDashboard role="admin" />
    </>
  );
}
