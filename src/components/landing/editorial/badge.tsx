"use client";

import { StatusDot } from "./status-dot";

/**
 * §5.7 Badge / Pill — two variants only: mono and signal.
 * 24px height, padding-x 8, radius 4, --text-mono, UC.
 */
export function Badge({
  children,
  variant = "mono",
}: {
  children: React.ReactNode;
  variant?: "mono" | "signal";
}) {
  if (variant === "signal") {
    return (
      <span
        className="inline-flex items-center gap-1.5"
        style={{
          height: 24,
          paddingInline: 8,
          borderRadius: 4,
          fontFamily: "var(--font-mono-landing)",
          fontSize: "var(--text-mono)",
          lineHeight: "var(--lh-mono)",
          letterSpacing: "var(--ls-mono)",
          textTransform: "uppercase",
          fontWeight: 500,
          color: "var(--ink)",
        }}
      >
        <StatusDot status="operational" />
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        paddingInline: 8,
        borderRadius: 4,
        border: "1px solid var(--rule)",
        fontFamily: "var(--font-mono-landing)",
        fontSize: "var(--text-mono)",
        lineHeight: "var(--lh-mono)",
        letterSpacing: "var(--ls-mono)",
        textTransform: "uppercase",
        fontWeight: 500,
        color: "var(--ink-60)",
      }}
    >
      {children}
    </span>
  );
}
