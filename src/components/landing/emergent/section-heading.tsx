"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bilingual section heading with scroll-reveal animation.
 * French title enters from the left, Arabic title from the right 200ms later.
 */
export function SectionHeading({
  fr,
  ar,
}: {
  fr: string;
  ar: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mb-16">
      { }
      <h2
        className="section-heading-fr"
        style={{
          fontFamily: "var(--font-sans-landing)",
          fontSize: "var(--text-h2)",
          lineHeight: "var(--lh-h2)",
          letterSpacing: "var(--ls-h2)",
          fontWeight: 600,
          color: "var(--ink)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0)" : "translateX(-32px)",
          transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
        }}
      >
        {fr}
      </h2>
      <p
        className="mt-3"
        style={{
          fontFamily: "var(--font-arabic)",
          fontSize: "var(--text-h3)",
          color: "var(--ink-60)",
          direction: "rtl",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0)" : "translateX(32px)",
          transition: "opacity 0.6s ease-out 0.2s, transform 0.6s ease-out 0.2s",
        }}
      >
        {ar}
      </p>
      { }
    </div>
  );
}
