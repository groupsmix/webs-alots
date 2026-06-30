"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase-client";

/**
 * Fetches open+in-progress support ticket count across ALL clinics
 * (super-admin cross-tenant view, intentional nosemgrep).
 * Polls every 2 minutes and returns a Badge when count > 0.
 */
export function SuperAdminSupportBadge() {
  const [count, setCount] = useState<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      // Super-admin intentionally queries across all tenants for cross-clinic view.
      // nosemgrep: semgrep.tenant-scoping — this is a deliberate cross-tenant super-admin query.
      const { count: c } = await supabase
        .from("support_tickets") // nosemgrep: semgrep.tenant-scoping
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      if (mountedRef.current) setCount(c ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const interval = setInterval(() => void load(), 120_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  if (!count || count === 0) return null;
  return (
    <Badge variant="destructive" className="ml-auto text-[9px] h-4 px-1">
      {count > 99 ? "99+" : count}
    </Badge>
  );
}
