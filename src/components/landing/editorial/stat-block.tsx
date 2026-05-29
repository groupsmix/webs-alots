"use client";

/**
 * §5.10 Stat Block — value + 1px rule + mono label.
 * 4-up desktop, 2-up mobile. Never wrapped in a card.
 */
export function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="font-[var(--font-sans-landing)] text-[length:var(--text-h2)] leading-[var(--lh-h2)] tracking-[var(--ls-h2)] font-medium text-[var(--ink)] truncate">
        {value}
      </span>
      <hr className="border-none border-t border-t-[var(--rule)] m-0" aria-hidden="true" />
      <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)] font-medium">
        {label}
      </span>
    </div>
  );
}
