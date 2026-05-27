"use client";

import { HairlineRule } from "../hairline-rule";

/**
 * Customers teaser \u2014 compressed logo row.
 *
 * 6 logos max, in greyscale, single row, hairline above and below.
 * If fewer than 6 real logos, show count + mono caption.
 */
export function CustomersTeaser() {
  return (
    <section style={{ backgroundColor: "var(--bone)" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingBlock: "var(--space-9)",
        }}
      >
        <HairlineRule />

        {/* eslint-disable i18next/no-literal-string */}
        <div
          className="flex items-center justify-center py-[var(--space-7)]"
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            textTransform: "uppercase",
            color: "var(--ink-60)",
          }}
        >
          <span>{"+12 cabinets en activit\u00E9"}</span>
        </div>
        {/* eslint-enable i18next/no-literal-string */}

        <HairlineRule />
      </div>
    </section>
  );
}
