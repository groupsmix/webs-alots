"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Calendar,
  Pill,
  CreditCard,
  CheckCircle2,
  Star,
  CalendarX,
  MessageCircle,
  Settings,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getCurrentUser,
  fetchNotifications,
  type NotificationView,
} from "@/lib/data/client";

// ---- Type Mapping ----

type NotificationType = "appointment" | "prescription" | "payment" | "general" | "review" | "cancellation";

function triggerToType(trigger: string): NotificationType {
  switch (trigger) {
    case "new_booking":
    case "booking_confirmation":
    case "reminder_24h":
    case "reminder_1h":
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

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  return then.toLocaleDateString();
}

export default function PatientNotificationsPage() {
  const [notifications, setNotifications] = useState<Array<NotificationView & { type: NotificationType; time: string }>>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    whatsapp: true,
    in_app: true,
    reminders: true,
    confirmations: true,
    payments: true,
    prescriptions: true,
  });
  const [savedPrefs, setSavedPrefs] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getCurrentUser().then(async (user) => {
      if (!user || controller.signal.aborted) { if (!controller.signal.aborted) setPageLoading(false); return; }
      const notifs = await fetchNotifications(user.id);
      if (controller.signal.aborted) return;
      setNotifications(notifs.map((n) => ({
        ...n,
        type: triggerToType(n.trigger),
        time: formatTimeAgo(n.createdAt),
      })));
      setPageLoading(false);
    }).catch(() => {
      // ignored — component unmounted or fetch failed
    });
    return () => { controller.abort(); };
  }, []);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  const displayed = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true, status: "read" as const } : n)));
  };

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true, status: "read" as const })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const handleSavePrefs = () => {
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrefsOpen(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Preferences
          </Button>
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs defaultValue="all" className="mb-4">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setFilter("all")}>
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread" onClick={() => setFilter("unread")}>
            Unread ({unreadCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        )}
        {displayed.map((notification) => {
          const nType = notification.type;
          const Icon = iconMap[nType];
          return (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${!notification.read ? "border-l-4 border-l-primary" : "opacity-75"}`}
              onClick={() => markAsRead(notification.id)}
            >
              <CardContent className="flex items-start gap-4 pt-4 pb-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${colorMap[nType]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {!notification.read && <Badge className="text-[10px]">New</Badge>}
                    {notification.priority === "urgent" && (
                      <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-muted-foreground">{notification.time}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {notification.channel === "in_app" ? "In-App" : notification.channel}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notification Preferences Dialog */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notification Preferences</DialogTitle>
            <DialogDescription>Choose how you want to receive notifications</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Channels</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    <Label>WhatsApp Notifications</Label>
                  </div>
                  <Switch
                    checked={prefs.whatsapp}
                    onCheckedChange={(v) => setPrefs({ ...prefs, whatsapp: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    <Label>In-App Notifications</Label>
                  </div>
                  <Switch
                    checked={prefs.in_app}
                    onCheckedChange={(v) => setPrefs({ ...prefs, in_app: v })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Notification Types</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Appointment Reminders</Label>
                  <Switch
                    checked={prefs.reminders}
                    onCheckedChange={(v) => setPrefs({ ...prefs, reminders: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Booking Confirmations</Label>
                  <Switch
                    checked={prefs.confirmations}
                    onCheckedChange={(v) => setPrefs({ ...prefs, confirmations: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Payment Receipts</Label>
                  <Switch
                    checked={prefs.payments}
                    onCheckedChange={(v) => setPrefs({ ...prefs, payments: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Prescription Updates</Label>
                  <Switch
                    checked={prefs.prescriptions}
                    onCheckedChange={(v) => setPrefs({ ...prefs, prescriptions: v })}
                  />
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleSavePrefs}>
              {savedPrefs ? "Saved!" : "Save Preferences"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
