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

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase-client";

export function AdminHeaderBar() {
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void loadTicketCount();
    const interval = setInterval(() => void loadTicketCount(), 120_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  async function loadTicketCount() {
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
  }

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

/**
 * Sidebar-level support badge for the admin nav.
 * Used inside SidebarContent to show open ticket count next to the Support link.
 */
export function AdminSupportBadge() {
  const [count, setCount] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const interval = setInterval(() => void load(), 120_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  async function load() {
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
      const { count: c } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .in("status", ["open", "in_progress"]);
      if (mountedRef.current) setCount(c ?? 0);
    } catch {
      // ignore
    }
  }

  if (!count || count === 0) return null;
  return (
    <Badge variant="destructive" className="ml-auto text-[9px] h-4 px-1">
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

// Re-export Bell so admin layout doesn't import lucide directly just for this
export { Bell };
