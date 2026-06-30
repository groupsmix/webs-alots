"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative looping background video for the auth hero panel.
 *
 * Rendered as a client component so playback can be forced: several desktop
 * browsers refuse muted autoplay until the page explicitly calls play(),
 * which otherwise leaves a frozen first frame ("static") on screen. We also
 * retry on the first user interaction and whenever the tab becomes visible
 * again.
 *
 * The element stays `aria-hidden` + `muted`, so it contributes no audio and
 * is exempt from the axe `video-caption` rule enforced by
 * e2e/accessibility.spec.ts. It is intentionally NOT hidden under
 * prefers-reduced-motion: the looping brand video is the requested effect.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    video.muted = true;

    const play = () => {
      void video.play().catch(() => {
        // Autoplay blocked by the browser; we retry on interaction below.
      });
    };

    play();

    const resume = () => play();
    window.addEventListener("pointerdown", resume, { once: true });
    document.addEventListener("visibilitychange", play);

    return () => {
      window.removeEventListener("pointerdown", resume);
      document.removeEventListener("visibilitychange", play);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
    >
      <source src="/login-bg.mp4" type="video/mp4" />
    </video>
  );
}
