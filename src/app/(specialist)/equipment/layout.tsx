// SC-01: Server component layout — client-interactive shell extracted to
// @/components/layouts/equipment-layout-shell (a "use client" component).
import EquipmentLayoutShell from "@/components/layouts/equipment-layout-shell";

// Re-export types and hooks for backward compatibility
export { useEquipmentLocale, type EquipmentLocale } from "@/components/layouts/equipment-layout-shell";

export default function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EquipmentLayoutShell>{children}</EquipmentLayoutShell>;
}
