"use client";

/**
 * ECG-style vertical pulse line running along the left edge (right in RTL).
 * A surgical-sage blip travels down every 3.5s at resting heartbeat cadence.
 */
export function EcgPulse({ rtl }: { rtl: boolean }) {
  return (
    <div
      className="pointer-events-none fixed top-0 bottom-0 z-40"
      style={{ [rtl ? "right" : "left"]: 0, width: 1 }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--rule)" }}
      />
      <div
        className="ecg-blip absolute"
        style={{
          width: 1,
          height: 24,
          backgroundColor: "var(--surgical-sage)",
          boxShadow: "0 0 6px var(--surgical-sage-halo)",
          animation: "ecgTravel 3.5s linear infinite",
        }}
      />
      <style>{`
        @keyframes ecgTravel {
          0% { top: 0; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ecg-blip { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
