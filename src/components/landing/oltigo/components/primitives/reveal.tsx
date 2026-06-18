"use client";

import { createElement, useCallback, useRef, useState, type ElementType } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children?: React.ReactNode;
  className?: string;
  /** Stagger delay in ms. */
  delay?: number;
  /** Use the hairline draw-in animation instead of the settle. */
  variant?: "settle" | "line";
  as?: ElementType;
};

/**
 * Calm reveal-on-scroll. Adds `.is-visible` once the element enters the
 * viewport (once only, never loops). Honors prefers-reduced-motion via CSS.
 *
 * `attach` is a callback ref: the IntersectionObserver is wired at commit time,
 * never during render. (The react-hooks/refs rule can't distinguish a callback
 * ref passed to createElement from a render-phase ref read, hence the scoped
 * disable below.)
 */
export function Reveal({ children, className, delay = 0, variant = "settle", as }: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const [visible, setVisible] = useState(false);
  const started = useRef(false);

  const attach = useCallback((node: HTMLElement | null) => {
    if (!node || started.current) return;
    started.current = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(node);
  }, []);

  return createElement(
    Tag,
    // eslint-disable-next-line react-hooks/refs -- callback ref, attached at commit, not read in render
    {
      ref: attach,
      className: cn(
        variant === "line" ? "draw-line" : "reveal",
        visible && "is-visible",
        className,
      ),
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
}
