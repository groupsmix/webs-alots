"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const RevenueLineChart = dynamic(() => import("./_revenue-line-chart"), {
  ssr: false,
  loading: () => <div className="h-[240px] animate-pulse rounded-md bg-muted" />,
});

export default function RevenueLineChartWrapper(props: ComponentProps<typeof RevenueLineChart>) {
  return <RevenueLineChart {...props} />;
}
