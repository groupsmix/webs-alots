import { Activity, HeartPulse, Pill, Stethoscope, Syringe, Thermometer } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function getServiceIcon(name: string, category?: string | null): LucideIcon {
  const key = `${name} ${category ?? ""}`.toLowerCase();
  if (key.includes("vaccin") || key.includes("vaccination")) return Syringe;
  if (
    key.includes("ecg") ||
    key.includes("cardio") ||
    key.includes("blood pressure") ||
    key.includes("tension")
  )
    return HeartPulse;
  if (
    key.includes("consult") ||
    key.includes("général") ||
    key.includes("general") ||
    key.includes("follow")
  )
    return Stethoscope;
  if (
    key.includes("exam") ||
    key.includes("test") ||
    key.includes("dianostic") ||
    key.includes("screening")
  )
    return Activity;
  if (key.includes("fever") || key.includes("temp") || key.includes("temperature"))
    return Thermometer;
  if (key.includes("medic") || key.includes("drug") || key.includes("prescription")) return Pill;
  return Stethoscope;
}
