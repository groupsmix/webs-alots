"use client";

import { useEffect, useState } from "react";

/**
 * Editorial-institutional legal/document layout.
 *
 * Shared chrome for static document pages (privacy, terms, accessibility).
 * Design direction: Stripe-docs measure + Linear typographic restraint +
 * Bloomberg-terminal mono metadata. See docs design tokens in tokens.css:
 * --ink / --bone / --oltigo-green / --rule plus --font-*-landing.
 *
 * Renders a ~58% reading measure with a sticky, scroll-spied table of
 * contents in the left gutter on desktop. Mono section numbers, hairline
 * dividers, no shadows.
 */

export interface LegalDocSection {
  /** Stable anchor id (also the scroll target). */
  id: string;
  /** Mono section number, e.g. "01". */
  number: string;
  /** Section heading. */
  title: string;
  /** Section body. */
  children: React.ReactNode;
}

export function LegalDoc({
  title,
  lastUpdated,
  sections,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalDocSection[];
}) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div
      style={{
        backgroundColor: "var(--bone)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans-landing)",
      }}
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingBlock: "var(--space-9)",
        }}
      >
        {/* Mono eyebrow */}
        <div
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            textTransform: "uppercase",
            color: "var(--ink-60)",
          }}
        >
          OLTIGO · DOCUMENT · MISE À JOUR {lastUpdated}
        </div>

        <div style={{ height: "var(--space-4)" }} />

        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-sans-landing)",
            fontSize: "clamp(2rem, 4vw, var(--text-h1))",
            lineHeight: "var(--lh-h1)",
            letterSpacing: "var(--ls-h1)",
            fontWeight: 500,
            color: "var(--ink)",
            maxWidth: "75%",
          }}
        >
          {title}
        </h1>

        <div style={{ height: "var(--space-7)" }} />
        <hr style={{ border: "none", borderTop: "1px solid var(--rule)", margin: 0 }} />
        <div style={{ height: "var(--space-7)" }} />

        <div
          className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]"
          style={{ alignItems: "start" }}
        >
          {/* Sticky TOC (desktop only) */}
          <nav
            aria-label="Sommaire"
            className="hidden lg:block"
            style={{ position: "sticky", top: "var(--space-8)" }}
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sections.map((s) => {
                const active = s.id === activeId;
                return (
                  <li key={s.id} style={{ marginBottom: "var(--space-2)" }}>
                    <a
                      href={`#${s.id}`}
                      style={{
                        display: "flex",
                        gap: 8,
                        fontFamily: "var(--font-mono-landing)",
                        fontSize: "var(--text-mono)",
                        letterSpacing: "var(--ls-mono)",
                        textTransform: "uppercase",
                        color: active ? "var(--oltigo-green)" : "var(--ink-60)",
                        textDecoration: "none",
                        paddingInlineStart: 10,
                        borderInlineStart: `2px solid ${active ? "var(--oltigo-green)" : "var(--rule)"}`,
                        lineHeight: 1.4,
                        transition: "color var(--duration) var(--easing)",
                      }}
                    >
                      <span>{s.number}</span>
                      <span>{s.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Document body */}
          <div style={{ maxWidth: "68ch" }}>
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} style={{ scrollMarginTop: "var(--space-8)" }}>
                {i > 0 && (
                  <>
                    <div style={{ height: "var(--space-7)" }} />
                    <hr style={{ border: "none", borderTop: "1px solid var(--rule)", margin: 0 }} />
                    <div style={{ height: "var(--space-7)" }} />
                  </>
                )}
                <div
                  style={{
                    fontFamily: "var(--font-mono-landing)",
                    fontSize: "var(--text-mono)",
                    letterSpacing: "var(--ls-mono)",
                    textTransform: "uppercase",
                    color: "var(--ink-60)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  {s.number}
                </div>
                <h2
                  style={{
                    fontFamily: "var(--font-sans-landing)",
                    fontSize: "var(--text-h3)",
                    lineHeight: "var(--lh-h3)",
                    letterSpacing: "var(--ls-h3)",
                    fontWeight: 500,
                    color: "var(--ink)",
                    marginBottom: "var(--space-4)",
                  }}
                >
                  {s.title}
                </h2>
                <div className="legal-doc-body">{s.children}</div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .legal-doc-body {
          font-family: var(--font-sans-landing);
          font-size: var(--text-body);
          line-height: var(--lh-body);
          color: var(--ink-80);
        }
        .legal-doc-body p { margin: 0 0 var(--space-4) 0; }
        .legal-doc-body p:last-child { margin-bottom: 0; }
        .legal-doc-body h3 {
          font-family: var(--font-sans-landing);
          font-size: var(--text-body-lg);
          line-height: var(--lh-body-lg);
          font-weight: 500;
          color: var(--ink);
          margin: var(--space-5) 0 var(--space-3) 0;
        }
        .legal-doc-body ul {
          margin: 0 0 var(--space-4) 0;
          padding-inline-start: 0;
          list-style: none;
        }
        .legal-doc-body li {
          position: relative;
          padding-inline-start: 20px;
          margin-bottom: var(--space-2);
        }
        .legal-doc-body li::before {
          content: "";
          position: absolute;
          inset-inline-start: 0;
          top: 11px;
          width: 6px;
          height: 1px;
          background: var(--oltigo-green);
        }
        .legal-doc-body strong { color: var(--ink); font-weight: 600; }
        .legal-doc-body code {
          font-family: var(--font-mono-landing);
          font-size: 0.85em;
          background: var(--rule);
          padding: 1px 5px;
          border-radius: 4px;
          color: var(--ink);
        }
        .legal-doc-body a {
          color: var(--oltigo-green);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
