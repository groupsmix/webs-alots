import { cn } from "@/lib/utils";

type MarkSize = "sm" | "md" | "lg" | "xl";

const WORDMARK_SIZE: Record<MarkSize, string> = {
  sm: "text-base", // 16px
  md: "text-xl", // 20px
  lg: "text-2xl", // 24px
  xl: "text-[2rem]", // 32px
};

/**
 * Oltigo wordmark — the canonical brand lockup.
 *
 * Deliberately typographic (not an icon-in-a-rounded-square): the name set in
 * Inter, lowercase, tight tracking, with the trailing "o" carried in the
 * brand green as the single ownable accent. Base glyphs inherit `currentColor`
 * so the mark adapts to ink-on-bone / bone-on-ink contexts.
 */
export function OltigoWordmark({
  size = "md",
  className,
}: {
  size?: MarkSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline font-sans font-bold lowercase leading-none tracking-[-0.03em]",
        WORDMARK_SIZE[size],
        className,
      )}
      role="img"
      aria-label="Oltigo"
    >
      <span aria-hidden>oltig</span>
      <span aria-hidden style={{ color: "var(--primary)" }}>
        o
      </span>
    </span>
  );
}

const MONOGRAM_SIZE: Record<MarkSize, string> = {
  sm: "h-7 w-7 text-base",
  md: "h-9 w-9 text-lg",
  lg: "h-11 w-11 text-xl",
  xl: "h-14 w-14 text-2xl",
};

/**
 * Compact monogram for tight spaces (collapsed sidebars, avatars, favicons).
 *
 * A hairline-ruled square holding the lowercase "o" with the green accent —
 * the structural hairline + accent echo the wordmark rather than introducing a
 * generic filled-tile-with-icon logo.
 */
export function OltigoMonogram({
  size = "md",
  className,
}: {
  size?: MarkSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center justify-center rounded-[3px] font-sans font-bold leading-none",
        MONOGRAM_SIZE[size],
        className,
      )}
      style={{
        border: "1px solid var(--rule)",
        color: "var(--primary)",
        backgroundColor: "var(--card)",
      }}
      role="img"
      aria-label="Oltigo"
    >
      <span aria-hidden>o</span>
    </span>
  );
}
