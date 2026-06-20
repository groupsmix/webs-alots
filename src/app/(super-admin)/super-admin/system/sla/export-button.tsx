"use client";

import { useCallback, useState } from "react";
import { logger } from "@/lib/logger";

/**
 * Client component that triggers a file download via fetch + blob instead of
 * navigating to the API endpoint. This avoids opening a new tab with raw HTML
 * and ensures Content-Disposition: attachment is respected even on browsers
 * that ignore it for same-origin navigations.
 */
export function SlaExportButton({
  reportMonth,
  disabled: exportDisabled,
}: {
  reportMonth: string;
  /** When true the button is greyed out and shows a tooltip explaining why. */
  disabled?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/system/sla-report?month=${reportMonth}`, {
        credentials: "include",
      });
      if (!res.ok) {
        logger.warn("SLA report download failed", { status: res.status });
        setError(`Download failed (status ${String(res.status)}). Please try again.`);
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
      setError("Download failed due to a network error. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [reportMonth]);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading || exportDisabled}
        title={
          exportDisabled
            ? "Aucune donnée SLA enregistrée — l'export sera disponible une fois les données collectées."
            : undefined
        }
        className={`inline-flex rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? "border-red-300 text-red-700" : ""
        }`}
      >
        {downloading ? "Téléchargement…" : error ? "Échec — Réessayer" : "Exporter le rapport"}
      </button>
      {exportDisabled && (
        <p className="text-xs text-muted-foreground">
          Export indisponible : aucune donnée SLA pour ce mois.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
