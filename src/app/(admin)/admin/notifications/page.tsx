"use client";

import { AlertTriangle, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/data/client";
import { fetchNotificationDashboardData, type NotificationDashboardData } from "@/lib/data/client/notification-dashboard";

export default function AdminNotificationsPage() {
  const [data, setData] = useState<NotificationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (user?.clinic_id) {
        const dashboardData = await fetchNotificationDashboardData(user.clinic_id);
        setData(dashboardData);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!data) return <div className="p-8 text-red-500">Failed to load notification data.</div>;

  const { templates, recentLogs, queueStatus } = data;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin Dashboard", href: "/admin/dashboard" }, { label: "Notifications" }]} />
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notification Status</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="rounded-full p-3 bg-blue-50 text-blue-600">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">WhatsApp Templates</p>
              <h3 className="text-2xl font-bold">{templates.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="rounded-full p-3 bg-green-50 text-green-600">
              <Send className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recent Sends (7d)</p>
              <h3 className="text-2xl font-bold">{recentLogs.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="rounded-full p-3 bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Failed / Dead-lettered</p>
              <h3 className="text-2xl font-bold">{queueStatus.failed} / {queueStatus.deadLettered}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">WhatsApp Templates</TabsTrigger>
          <TabsTrigger value="logs">Recent Logs</TabsTrigger>
          <TabsTrigger value="queue">Retry Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No custom templates found. Using default standard templates.
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium">{tpl.template_name} ({tpl.language})</div>
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{tpl.body_template}</div>
                      </div>
                      <Badge variant={tpl.status === 'approved' ? 'success' : 'outline'}>{tpl.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sends</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No recent notifications sent.</div>
              ) : (
                <div className="space-y-4">
                  {recentLogs.map(log => (
                    <div key={log.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium">{log.trigger} &rarr; {log.recipientName || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <span className="capitalize">{log.channel}</span> &bull; 
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge variant={log.status === 'sent' || log.status === 'delivered' ? 'success' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Failed & Pending Queue</CardTitle>
            </CardHeader>
            <CardContent>
              {queueStatus.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Queue is empty.</div>
              ) : (
                <div className="space-y-4">
                  {queueStatus.items.map(item => {
                    const isDeadLetter = item.next_attempt_at?.startsWith("9999");
                    return (
                      <div key={item.id} className="flex justify-between items-start border-b pb-4 last:border-0 last:pb-0">
                        <div>
                          <div className="font-medium capitalize">{item.channel} to {item.recipient}</div>
                          <div className="text-sm text-red-600 mt-1">{item.error_message || "Unknown error"}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Attempts: {item.attempts} &bull; Next Retry: {isDeadLetter ? 'Never (Dead-lettered)' : new Date(item.next_attempt_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={isDeadLetter ? "destructive" : "warning"}>
                          {isDeadLetter ? "Dead Letter" : item.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
