"use client";

/**
 * §5.10 Stat Block — value + 1px rule + mono label.
 * 4-up desktop, 2-up mobile. Never wrapped in a card.
 */
export function StatBlock({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontFamily: "var(--font-sans-landing)",
          fontSize: "var(--text-h2)",
          lineHeight: "var(--lh-h2)",
          letterSpacing: "var(--ls-h2)",
          fontWeight: 500,
          color: "var(--ink)",
        }}
      >
        {value}
      </span>
      <hr
        style={{ border: "none", borderTop: "1px solid var(--rule)", margin: 0 }}
        aria-hidden="true"
      />
      <span
        style={{
          fontFamily: "var(--font-mono-landing)",
          fontSize: "var(--text-mono)",
          lineHeight: "var(--lh-mono)",
          letterSpacing: "var(--ls-mono)",
          textTransform: "uppercase",
          color: "var(--ink-60)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}
