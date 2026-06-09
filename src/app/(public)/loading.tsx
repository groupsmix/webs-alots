import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading skeleton for the public marketing site.
 *
 * Audit F-4 (CLS): the hero skeleton MUST reserve the same vertical space as the
 * real hero (src/components/landing/editorial/hero-section.tsx) so the page does
 * not jump when streamed content replaces this fallback. The previous skeleton
 * reserved a single `h-12` (~48px) bar for a headline that actually renders at
 * `clamp(2.5rem, 5vw, 4.5rem)` over two lines (~150px), which is the layout
 * shift the audit flagged.
 *
 * Heights and spacers below mirror the design tokens in src/app/tokens.css:
 *   --space-9 = 96px, --space-10 = 128px, --space-6 = 32px, --space-5 = 24px,
 *   display headline = clamp(2.5rem, 5vw, 4.5rem) @ line-height ~1.02,
 *   body-lg subhead = 19px, CTA buttons = h-11 (44px).
 */
export default function PublicLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton — mirrors <EditorialHero> footprint to keep CLS < 0.1.
          Decorative only; hidden from assistive tech. */}
      <section className="bg-[var(--bone)]" aria-hidden="true">
        <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
          <div className="h-[var(--space-9)]" />

          {/* Mono eyebrow (~12px line) */}
          <Skeleton className="h-4 w-56 rounded" />

          <div className="h-[var(--space-5)]" />

          {/* Display headline — reserve the real clamp() line box. Two lines on
              md+ (75% width); a third line appears only on small screens where
              the 40px headline wraps further, matching the real wrap. */}
          <div className="max-w-full space-y-3 md:max-w-[75%]">
            <Skeleton className="h-[clamp(2.5rem,5vw,4.5rem)] w-full rounded-lg" />
            <Skeleton className="h-[clamp(2.5rem,5vw,4.5rem)] w-4/5 rounded-lg" />
            <Skeleton className="h-[clamp(2.5rem,5vw,4.5rem)] w-3/5 rounded-lg md:hidden" />
          </div>

          <div className="h-[var(--space-5)]" />

          {/* Subhead — body-lg, ~58% width, two lines */}
          <div className="max-w-full space-y-2 md:max-w-[58%]">
            <Skeleton className="h-[1.1875rem] w-full rounded" />
            <Skeleton className="h-[1.1875rem] w-11/12 rounded" />
          </div>

          <div className="h-[var(--space-6)]" />

          {/* CTAs — match the real h-11 buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-11 w-44 rounded-[var(--radius-landing)]" />
            <Skeleton className="h-11 w-36 rounded-[var(--radius-landing)]" />
            <Skeleton className="h-11 w-32 rounded-[var(--radius-landing)]" />
          </div>

          <div className="h-[var(--space-10)]" />

          {/* Trust hairline + 4 stat blocks (grid-cols-2 → md:grid-cols-4) */}
          <div className="border-t border-[var(--ink-20)]" />
          <div className="py-[var(--space-5)]">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-7 w-16 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--ink-20)]" />

          <div className="h-[var(--space-9)]" />
        </div>
      </section>

      {/* Services section skeleton (below the fold) */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-3">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-5 w-72 mx-auto" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-6 space-y-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-9 w-28 rounded-lg mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews section skeleton */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-3">
            <Skeleton className="h-8 w-64 mx-auto" />
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-8 w-12" />
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-5 rounded-sm" />
                ))}
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-4 rounded-sm" />
                  ))}
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-24 mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
