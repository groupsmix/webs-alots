"use client";

type StatusDotVariant = "operational" | "degraded" | "down";

const dotColor: Record<StatusDotVariant, string> = {
  operational: "var(--signal-green)",
  degraded: "#F59E0B",
  down: "#B42318",
};

const dotLabel: Record<StatusDotVariant, string> = {
  operational: "System operational",
  degraded: "System degraded",
  down: "System down",
};

/**
 * Status dot — 6px round indicator paired with a mono label.
 * Never standalone per spec.
 */
export function StatusDot({
  variant = "operational",
  label,
}: {
  variant?: StatusDotVariant;
  label?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-[var(--space-1)]"
      role="status"
      aria-label={label ?? dotLabel[variant]}
    >
      <span
        className="inline-block shrink-0 rounded-full"
        style={{
          width: "6px",
          height: "6px",
          backgroundColor: dotColor[variant],
        }}
      />
    </span>
  );
}
