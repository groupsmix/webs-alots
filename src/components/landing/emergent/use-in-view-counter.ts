"use client";

import { useCallback, useRef, useState } from "react";

export function useInViewCounter(end: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const hasTriggered = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const callbackRef = useCallback(
    (node: HTMLSpanElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node || hasTriggered.current) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting || hasTriggered.current) return;
          hasTriggered.current = true;
          observer.disconnect();

          const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (prefersReduced) {
            setValue(end);
            return;
          }

          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        },
        { threshold: 0.3 },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [end, duration],
  );

  return { setNode: callbackRef, value };
}
