"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase-client";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: "info" | "warning" | "success";
}

const READ_STORAGE_KEY = "oltigo_read_notif_ids";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

const TYPE_ICONS: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

const TYPE_COLORS: Record<string, string> = {
  info: "text-blue-600",
  warning: "text-amber-500",
  success: "text-green-600",
};

export function NotificationBell({ userId }: { userId?: string }): ReactNode {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(true);

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      const profileId = profile?.id ?? userId;
      if (!profileId || !mountedRef.current) return;

      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, sent_at, is_read")
        .eq("user_id", profileId)
        .order("sent_at", { ascending: false })
        .limit(15);

      if (!mountedRef.current) return;

      const readIds = getReadIds();

      const mapped: Notification[] = (data ?? []).map((n) => {
        const sentAt = new Date(n.sent_at ?? Date.now());
        const diffMs = Date.now() - sentAt.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);
        let time = "just now";
        if (diffDay > 0) time = `${diffDay}d ago`;
        else if (diffHr > 0) time = `${diffHr}h ago`;
        else if (diffMin > 0) time = `${diffMin}m ago`;

        return {
          id: n.id,
          title: n.title ?? "Notification",
          message: n.body ?? "",
          time,
          unread: readIds.has(n.id) ? false : !n.is_read,
          type: "info",
        };
      });

      setNotifications(mapped);
    } catch {
      // silently fail — bell is non-critical
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 60_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  async function markOneRead(id: string) {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    // Persist to local storage for client-side persistence
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);
    // Persist to server
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // best-effort
    }
  }

  async function markAllRead() {
    const allIds = new Set(notifications.map((n) => n.id));
    saveReadIds(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    // Server-side: mark each unread
    const unread = notifications.filter((n) => n.unread);
    await Promise.allSettled(
      unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" })),
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        )}
        {notifications.slice(0, 8).map((notif) => {
          const Icon = TYPE_ICONS[notif.type] ?? Info;
          return (
            <DropdownMenuItem
              key={notif.id}
              className="flex items-start gap-2 py-2 cursor-pointer"
              onClick={() => void markOneRead(notif.id)}
            >
              <Icon
                className={`h-4 w-4 mt-0.5 shrink-0 ${TYPE_COLORS[notif.type] ?? "text-muted-foreground"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{notif.title}</p>
                  {notif.unread && (
                    <Badge variant="default" className="text-[9px] px-1 py-0 shrink-0">
                      New
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                <p className="text-[10px] text-muted-foreground">{notif.time}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
