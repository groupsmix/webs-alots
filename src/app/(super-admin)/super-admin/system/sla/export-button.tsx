"use client";

import { useCallback, useState } from "react";
import { logger } from "@/lib/logger";

/**
 * Client component that triggers a file download via fetch + blob instead of
 * navigating to the API endpoint. This avoids opening a new tab with raw HTML
 * and ensures Content-Disposition: attachment is respected even on browsers
 * that ignore it for same-origin navigations.
 */
export function SlaExportButton({ reportMonth }: { reportMonth: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/system/sla-report?month=${reportMonth}`, {
        credentials: "include",
      });
      if (!res.ok) {
        logger.warn("SLA report download failed", { status: res.status });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sla-report-${reportMonth}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.warn("SLA report download error", { error: err });
    } finally {
      setDownloading(false);
    }
  }, [reportMonth]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
    >
      {downloading ? "Downloading..." : "Export latest report"}
    </button>
  );
}
