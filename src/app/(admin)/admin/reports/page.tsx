import dynamic from "next/dynamic";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";

const AnalyticsDashboard = dynamic(
  () => import("@/components/analytics/analytics-dashboard").then((m) => m.AnalyticsDashboard),
  { loading: () => <PageLoader message="Loading analytics..." /> },
);

export default function ReportsPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Reports" }]} />
      {/* eslint-disable-next-line jsx-a11y/aria-role -- role prop is a business-logic attribute, not an ARIA role */}
      <AnalyticsDashboard role="admin" />
    </>
  );
}
