"use client";

/**
 * Thin header overlay for the admin layout that provides:
 * - Notification bell with unread count + mark-as-read (NOT-002)
 * - Open ticket count badge on the Support nav link (SUP-008)
 *
 * Rendered inside AdminLayoutShell so it has access to React hooks and
 * the Supabase client, without needing to convert the entire shell to a
 * hook-heavy component.
 */

import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase-client";

export function AdminHeaderBar() {
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const mountedRef = useRef(true);

  const loadTicketCount = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      const { data: profile } = await supabase
        .from("users")
        .select("clinic_id")
        .eq("auth_id", user.id)
        .single();

      if (!profile?.clinic_id || !mountedRef.current) return;

      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .in("status", ["open", "in_progress"]);

      if (mountedRef.current) setOpenTickets(count ?? 0);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    mountedRef.current = true;

    timeouts.push(
      setTimeout(() => {
        void loadTicketCount();
      }, 0),
    );

    const interval = setInterval(() => void loadTicketCount(), 120_000);

    return () => {
      timeouts.forEach((t) => clearTimeout(t));

      (() => {
        mountedRef.current = false;
        clearInterval(interval);
      })();
    };
  }, [loadTicketCount]);

  return (
    <div className="fixed top-0 right-0 left-64 z-30 hidden h-12 items-center justify-end gap-2 border-b bg-background px-4 md:flex">
      <NotificationBell />
      {openTickets != null && openTickets > 0 && (
        <Link href="/admin/support" className="flex items-center">
          <Badge variant="destructive" className="text-[10px]">
            {openTickets} ticket{openTickets > 1 ? "s" : ""}
          </Badge>
        </Link>
      )}
    </div>
  );
}

// Re-export Bell so admin layout doesn't import lucide directly just for this
