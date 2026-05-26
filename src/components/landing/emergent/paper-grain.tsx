"use client";

/**
 * Subtle paper-grain overlay at ~2% opacity.
 * Uses an SVG noise filter for a cream prescription-pad texture.
 */
export function PaperGrain() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.02]">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
