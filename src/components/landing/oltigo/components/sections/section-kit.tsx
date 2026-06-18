import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("telemetry text-[15px] font-medium tracking-tight text-text", className)}>
      oltig<span className="text-emerald">.</span>o
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="telemetry text-[11px] uppercase tracking-[0.22em] text-emerald/80">
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "start",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "start" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={60}>
        <h2 className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] text-text">{title}</h2>
      </Reveal>
      {sub ? (
        <Reveal delay={120}>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">{sub}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
