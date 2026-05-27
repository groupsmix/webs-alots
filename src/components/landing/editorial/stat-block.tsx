"use client";

import { HairlineRule } from "./hairline-rule";

/**
 * Stat block — value + hairline + two lines of context.
 * 4-up on desktop, 2-up on mobile. Never wrapped in a card.
 */
export function StatBlock({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "var(--text-h2)",
          lineHeight: "var(--lh-h2)",
          letterSpacing: "var(--ls-h2)",
          fontWeight: 500,
          color: "var(--ink)",
        }}
      >
        {value}
      </p>
      <HairlineRule className="my-[var(--space-3)]" />
      <p
        style={{
          fontFamily: "var(--font-mono-landing)",
          fontSize: "var(--text-mono)",
          lineHeight: "var(--lh-mono)",
          letterSpacing: "var(--ls-mono)",
          textTransform: "uppercase",
          color: "var(--ink-60)",
        }}
      >
        {label}
      </p>
      <p
        className="mt-[var(--space-1)]"
        style={{
          fontSize: "var(--text-body)",
          lineHeight: "var(--lh-body)",
          color: "var(--ink-70)",
        }}
      >
        {description}
      </p>
    </div>
  );
}
