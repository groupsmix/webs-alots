"use client";

import { StatusDot } from "./status-dot";

type BadgeVariant = "mono" | "signal";

/**
 * Badge / Pill — two variants only.
 *
 * mono:   status, version, region. --ink-60 text on transparent with --rule border.
 * signal: live, operational, synced. --ink text + 6px --signal-green dot prefix, no border.
 */
export function Badge({
  variant = "mono",
  children,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  if (variant === "signal") {
    return (
      <span
        className="inline-flex items-center gap-[var(--space-1)]"
        style={{
          height: "24px",
          paddingInline: "var(--space-2)",
          borderRadius: "4px",
          fontFamily: "var(--font-mono-landing)",
          fontSize: "var(--text-mono)",
          lineHeight: "var(--lh-mono)",
          letterSpacing: "var(--ls-mono)",
          textTransform: "uppercase",
          color: "var(--ink)",
        }}
      >
        <StatusDot variant="operational" />
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "24px",
        paddingInline: "var(--space-2)",
        borderRadius: "4px",
        border: "1px solid var(--rule)",
        fontFamily: "var(--font-mono-landing)",
        fontSize: "var(--text-mono)",
        lineHeight: "var(--lh-mono)",
        letterSpacing: "var(--ls-mono)",
        textTransform: "uppercase",
        color: "var(--ink-60)",
      }}
    >
      {children}
    </span>
  );
}
