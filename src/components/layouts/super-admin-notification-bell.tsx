"use client";

import { Bell, CheckCheck, CheckCircle, Info, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";

type NotificationType = "info" | "warning" | "success";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: NotificationType;
}

const NOTIF_READ_KEY = "oltigo-sa-notif-read";

function getReadNotifIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_READ_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadNotifIds(ids: Set<string>): void {
  try {
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage may be unavailable
  }
}

const notifTypeIcon: Record<NotificationType, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

const notifTypeColor: Record<NotificationType, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-500 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
};

export function SuperAdminNotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const mountedRef = useRef(true);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const allIds = new Set(prev.map((n) => n.id));
      saveReadNotifIds(allIds);
      return prev.map((n) => ({ ...n, unread: false }));
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function loadNotifications() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mountedRef.current) return;

        const { data: profile } = await supabase
          .from("users")
          .select("id, clinic_id")
          .eq("auth_id", user.id)
          .abortSignal(AbortSignal.timeout(5000))
          .single();
        if (!profile || !mountedRef.current) return;

        // F-A96-02 / AGENTS.md rule #1: scope by clinic_id for tenant
        // isolation (defense-in-depth alongside RLS). user_id already pins
        // the result to the current user; clinic_id is applied when the
        // profile has one (super_admin has clinic_id = null and is unscoped).
        let notifQuery = supabase
          .from("notifications")
          .select("id, title, body, sent_at, is_read")
          .eq("user_id", profile.id);

        if (profile.clinic_id) {
          notifQuery = notifQuery.eq("clinic_id", profile.clinic_id);
        }

        const { data } = await notifQuery
          .order("sent_at", { ascending: false })
          .limit(10)
          .abortSignal(AbortSignal.timeout(5000));

        if (!mountedRef.current) return;

        const readIds = getReadNotifIds();

        if (data && data.length > 0) {
          setNotifications(
            data.map((n) => {
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
                type: "info" as NotificationType,
              };
            }),
          );
        } else {
          // XB2-fix: no real notifications → show an empty list so the bell
          // displays 0 instead of a stale mock count. Applies in every
          // environment (no env-gated mock data).
          setNotifications([]);
        }
      } catch (err) {
        logger.warn("Failed to load notifications", { context: "super-admin-layout", error: err });
        // On error, show empty list — don't leak stale mock counts in prod.
        setNotifications([]);
      }
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center rounded-md p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              {"Mark all as read"}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        )}
        {notifications.map((notif) => {
          const NotifIcon = notifTypeIcon[notif.type] ?? Info;
          return (
            <DropdownMenuItem key={notif.id} className="flex items-start gap-2 py-2">
              <NotifIcon
                className={`h-4 w-4 mt-0.5 shrink-0 ${notifTypeColor[notif.type] ?? "text-muted-foreground"}`}
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
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-center">
          <Link href="/super-admin/clinics" className="text-xs text-primary hover:underline">
            {"View all notifications"}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
