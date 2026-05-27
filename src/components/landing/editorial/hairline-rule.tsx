"use client";

/**
 * Hairline Rule — 1px --rule separator.
 *
 * The hairline is its own component because it carries information:
 * it separates statements (trust strip), groups (case study sections),
 * and signals scope (nav bottom rule).
 */
export function HairlineRule({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={className}
      style={{
        height: "1px",
        backgroundColor: "var(--rule)",
        width: "100%",
      }}
    />
  );
}
