import { Bell, Calendar, Pill, CreditCard, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  type: "appointment" | "prescription" | "payment" | "general";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const notifications: Notification[] = [
  { id: "n1", type: "appointment", title: "Appointment Reminder", message: "Your appointment with Dr. Ahmed Benali is tomorrow at 09:00.", time: "1 hour ago", read: false },
  { id: "n2", type: "prescription", title: "Prescription Ready", message: "Your prescription from Dr. Youssef El Amrani is ready for pickup.", time: "3 hours ago", read: false },
  { id: "n3", type: "payment", title: "Invoice Due", message: "Invoice #INV-003 of 400 MAD is pending payment.", time: "1 day ago", read: false },
  { id: "n4", type: "appointment", title: "Appointment Confirmed", message: "Your follow-up visit with Dr. Ahmed Benali on March 20 has been confirmed.", time: "2 days ago", read: true },
  { id: "n5", type: "general", title: "Welcome to the Patient Portal", message: "Complete your profile to get personalized health recommendations.", time: "1 week ago", read: true },
  { id: "n6", type: "prescription", title: "Medication Reminder", message: "Remember to take your Atorvastatin 20mg at bedtime.", time: "1 week ago", read: true },
];

const iconMap = {
  appointment: Calendar,
  prescription: Pill,
  payment: CreditCard,
  general: Bell,
};

const colorMap = {
  appointment: "text-blue-600 bg-blue-100 dark:bg-blue-900",
  prescription: "text-green-600 bg-green-100 dark:bg-green-900",
  payment: "text-purple-600 bg-purple-100 dark:bg-purple-900",
  general: "text-orange-600 bg-orange-100 dark:bg-orange-900",
};

export default function PatientNotificationsPage() {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Mark All Read
        </Button>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => {
          const Icon = iconMap[notification.type];
          return (
            <Card key={notification.id} className={!notification.read ? "border-l-4 border-l-primary" : "opacity-75"}>
              <CardContent className="flex items-start gap-4 pt-4 pb-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${colorMap[notification.type]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {!notification.read && <Badge className="text-[10px]">New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
