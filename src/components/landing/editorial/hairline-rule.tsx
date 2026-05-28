"use client";

/**
 * §5.12 Hairline Rule — the hairline carries information.
 * 1px --rule. Separates statements, groups, and signals scope.
 */
export function HairlineRule({ className = "" }: { className?: string }) {
  return (
    <hr
      className={`border-none border-t border-t-[var(--rule)] m-0 ${className}`}
      aria-hidden="true"
    />
  );
}
