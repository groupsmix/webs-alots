"use client";

import type { RealtimeStatus } from "@/lib/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";

const LABELS: Record<RealtimeStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  offline: "Offline",
};

const DOT: Record<RealtimeStatus, string> = {
  connecting: "bg-amber-400 animate-pulse",
  live: "bg-emerald-500",
  offline: "bg-muted-foreground/40",
};

/**
 * Small connection-status pill for live-updating views. Pairs with
 * `useRealtimeRefresh`. Announces changes politely to screen readers.
 */
export function RealtimeIndicator({
  status,
  className,
}: {
  status: RealtimeStatus;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <span className={cn("h-2 w-2 rounded-full", DOT[status])} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
