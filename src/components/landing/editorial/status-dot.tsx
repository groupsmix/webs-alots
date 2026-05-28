"use client";

/**
 * §5.11 Status Dot — 6px round, signal-green when operational.
 * Always paired with a mono label. Never standalone.
 */
export function StatusDot({
  status = "operational",
}: {
  status?: "operational" | "degraded" | "down";
}) {
  const colorClass =
    status === "operational"
      ? "bg-[var(--signal-green)]"
      : status === "degraded"
        ? "bg-[var(--signal-amber)]"
        : "bg-[var(--signal-red)]";

  const label =
    status === "operational"
      ? "System operational"
      : status === "degraded"
        ? "System degraded"
        : "System down";

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block size-1.5 rounded-full shrink-0 ${colorClass}`}
    />
  );
}
