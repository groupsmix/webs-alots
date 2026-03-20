"use client";

import { useState } from "react";
import { Bell, Calendar, Pill, CreditCard, Star, CalendarX, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  demoInAppNotifications,
  type NotificationTrigger,
} from "@/lib/notifications";

type NotificationType = "appointment" | "prescription" | "payment" | "general" | "review" | "cancellation";

function triggerToType(trigger: NotificationTrigger): NotificationType {
  switch (trigger) {
    case "new_booking":
    case "booking_confirmation":
    case "reminder_24h":
    case "reminder_2h":
    case "rescheduled":
    case "doctor_assigned":
    case "follow_up":
    case "no_show":
      return "appointment";
    case "prescription_ready":
      return "prescription";
    case "payment_received":
      return "payment";
    case "new_review":
      return "review";
    case "cancellation":
      return "cancellation";
    case "new_patient_registered":
    default:
      return "general";
  }
}

const iconMap: Record<NotificationType, typeof Bell> = {
  appointment: Calendar,
  prescription: Pill,
  payment: CreditCard,
  general: Bell,
  review: Star,
  cancellation: CalendarX,
};

const colorMap: Record<NotificationType, string> = {
  appointment: "text-blue-600 bg-blue-100 dark:bg-blue-900",
  prescription: "text-green-600 bg-green-100 dark:bg-green-900",
  payment: "text-purple-600 bg-purple-100 dark:bg-purple-900",
  general: "text-orange-600 bg-orange-100 dark:bg-orange-900",
  review: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900",
  cancellation: "text-red-600 bg-red-100 dark:bg-red-900",
};

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(() =>
    demoInAppNotifications
      .filter((n) => n.userId === userId)
      .map((n) => ({
        ...n,
        type: triggerToType(n.trigger),
        read: n.status === "read",
      })),
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) =>
        n.id === id ? { ...n, read: true, status: "read" as const } : n,
      ),
    );
  };

  const markAllRead = () => {
    setNotifications(
      notifications.map((n) => ({ ...n, read: true, status: "read" as const })),
    );
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-medium text-sm">
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1"
                  onClick={markAllRead}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((notification) => {
                  const nType = notification.type;
                  const Icon = iconMap[nType];
                  return (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-3 p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !notification.read ? "bg-primary/5" : ""
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${colorMap[nType]}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium truncate">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
