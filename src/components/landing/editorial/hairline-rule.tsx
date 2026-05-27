"use client";

/**
 * §5.12 Hairline Rule — the hairline carries information.
 * 1px --rule. Separates statements, groups, and signals scope.
 */
export function HairlineRule({ className = "" }: { className?: string }) {
  return (
    <hr
      className={className}
      style={{
        border: "none",
        borderTop: "1px solid var(--rule)",
        margin: 0,
      }}
      aria-hidden="true"
    />
  );
}
