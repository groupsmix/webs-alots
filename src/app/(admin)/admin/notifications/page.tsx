"use client";

import {
  Bell,
  Search,
  MessageCircle,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Edit,
  Save,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  demoNotificationLog,
  defaultNotificationTemplates,
  triggerMetadata,
  substituteVariables,
  type NotificationLogEntry,
  type NotificationTemplate,
  type NotificationTrigger,
} from "@/lib/notifications";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency, formatNumber, formatDisplayDate } from "@/lib/utils";

// ---- Status & Channel Badges ----

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Pending" },
  sent: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Sent" },
  delivered: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Delivered" },
  failed: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Failed" },
  read: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Read" },
};

const channelConfig: Record<string, { color: string; label: string }> = {
  whatsapp: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "WhatsApp" },
  in_app: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "In-App" },
  email: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", label: "Email" },
  sms: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "SMS" },
};

export default function AdminNotificationsPage() {
  const [locale] = useLocale();

  const [logs] = useState<NotificationLogEntry[]>(demoNotificationLog);
  const [templates, setTemplates] = useState<NotificationTemplate[]>(defaultNotificationTemplates);
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // ---- Notification Log Filtering ----
  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      log.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      log.title.toLowerCase().includes(search.toLowerCase()) ||
      log.body.toLowerCase().includes(search.toLowerCase());
    const matchChannel = filterChannel === "all" || log.channel === filterChannel;
    const matchStatus = filterStatus === "all" || log.status === filterStatus;
    return matchSearch && matchChannel && matchStatus;
  });

  // ---- Template Management ----
  const toggleTemplate = (id: string) => {
    setTemplates(templates.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const updateTemplateBody = (id: string, field: "body" | "whatsappBody", value: string) => {
    setTemplates(templates.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSaveTemplates = () => {
    setSavedFeedback("templates");
    setTimeout(() => setSavedFeedback(null), 2000);
  };

  // ---- Stats ----
  const totalSent = logs.filter((l) => l.status === "sent" || l.status === "delivered" || l.status === "read").length;
  const totalFailed = logs.filter((l) => l.status === "failed").length;
  const totalWhatsApp = logs.filter((l) => l.channel === "whatsapp").length;
  const totalInApp = logs.filter((l) => l.channel === "in_app").length;

  // ---- Preview Variables ----
  const previewVariables = {
    patient_name: "Karim Mansouri",
    doctor_name: "Dr. Ahmed Benali",
    clinic_name: "Demo Clinic",
    clinic_phone: "+212 6 00 00 00 00",
    clinic_address: "123 Rue Example, Casablanca",
    service_name: "General Consultation",
    date: "2026-03-20",
    time: "09:00",
    amount: "200",
    currency: "MAD",
    booking_url: "https://clinic.ma/book",
    payment_method: "card",
    invoice_id: "INV-001",
    review_stars: "5",
    review_comment: "Excellent service!",
  };

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Notifications" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notification Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage templates, view logs, and monitor notification delivery
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">Sent / Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFailed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalWhatsApp}</p>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalInApp}</p>
                <p className="text-xs text-muted-foreground">In-App</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs">
        <TabsList className="mb-6">
          <TabsTrigger value="logs">Notification Log</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
        </TabsList>

        {/* ========== NOTIFICATION LOG TAB ========== */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by recipient, title, or message..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="border rounded-md px-3 py-2 text-sm bg-background"
                    value={filterChannel}
                    onChange={(e) => setFilterChannel(e.target.value)}
                  >
                    <option value="all">All Channels</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="in_app">In-App</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                  <select
                    className="border rounded-md px-3 py-2 text-sm bg-background"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredLogs.length === 0 && (
                  <div className="text-center py-8">
                    <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications found</p>
                  </div>
                )}
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-4 ${log.status === "failed" ? "border-red-200 dark:border-red-800" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{log.title}</span>
                          <Badge className={`text-[10px] ${channelConfig[log.channel]?.color || ""}`}>
                            {channelConfig[log.channel]?.label || log.channel}
                          </Badge>
                          <Badge className={`text-[10px] ${statusConfig[log.status]?.color || ""}`}>
                            {statusConfig[log.status]?.label || log.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {triggerMetadata[log.trigger]?.label || log.trigger}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{log.body}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>To: <strong>{log.recipientName}</strong> ({log.recipientRole})</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDisplayDate(new Date(log.createdAt), typeof locale !== "undefined" ? locale : "fr", "datetime")}
                          </span>
                        </div>
                        {log.error && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            Error: {log.error}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {log.status === "delivered" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        {log.status === "failed" && <XCircle className="h-5 w-5 text-red-600" />}
                        {log.status === "read" && <Eye className="h-5 w-5 text-purple-600" />}
                        {log.status === "sent" && <Send className="h-5 w-5 text-blue-600" />}
                        {log.status === "pending" && <Clock className="h-5 w-5 text-yellow-600" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TEMPLATES TAB ========== */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Notification Templates</CardTitle>
                <Button size="sm" onClick={handleSaveTemplates}>
                  <Save className="h-4 w-4 mr-1" />
                  {savedFeedback === "templates" ? "Saved!" : "Save All"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure message templates for each trigger. Use placeholders:{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{patient_name}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{doctor_name}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{date}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{time}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{clinic_name}}"}</code>
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{template.label}</span>
                        <Badge variant={template.enabled ? "default" : "secondary"}>
                          {template.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        {template.channels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="outline"
                            className={`text-[10px] ${channelConfig[ch]?.color || ""}`}
                          >
                            {channelConfig[ch]?.label || ch}
                          </Badge>
                        ))}
                        <Badge variant="outline" className="text-[10px]">
                          {template.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.enabled}
                          onCheckedChange={() => toggleTemplate(template.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTemplate(editingTemplate === template.id ? null : template.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {editingTemplate === template.id ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium mb-1">In-App Message</p>
                          <Textarea
                            value={template.body}
                            onChange={(e) => updateTemplateBody(template.id, "body", e.target.value)}
                            className="min-h-[60px]"
                          />
                        </div>
                        {template.channels.includes("whatsapp") && (
                          <div>
                            <p className="text-xs font-medium mb-1">WhatsApp Message</p>
                            <Textarea
                              value={template.whatsappBody}
                              onChange={(e) => updateTemplateBody(template.id, "whatsappBody", e.target.value)}
                              className="min-h-[60px]"
                            />
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Recipients: {template.recipientRoles.join(", ")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                          {template.body}
                        </p>
                        {template.channels.includes("whatsapp") && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageCircle className="h-3 w-3 text-green-600" />
                            {template.whatsappBody}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TRIGGERS TAB ========== */}
        <TabsContent value="triggers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Notification Triggers</CardTitle>
              <p className="text-sm text-muted-foreground">
                Overview of all events that can trigger notifications
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {(Object.entries(triggerMetadata) as [NotificationTrigger, { label: string; description: string }][]).map(
                  ([trigger, meta]) => {
                    const template = templates.find((t) => t.trigger === trigger);
                    const logCount = logs.filter((l) => l.trigger === trigger).length;
                    return (
                      <div key={trigger} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{meta.label}</span>
                          <div className="flex items-center gap-1">
                            {template ? (
                              <Badge variant={template.enabled ? "default" : "secondary"} className="text-[10px]">
                                {template.enabled ? "Active" : "Inactive"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">No Template</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{meta.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {template && (
                            <span>
                              Channels: {template.channels.map((ch) => channelConfig[ch]?.label || ch).join(", ")}
                            </span>
                          )}
                          <span>{logCount} sent</span>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Preview Dialog */}
      <Dialog open={previewTemplate !== null} onOpenChange={() => setPreviewTemplate(null)}>
        {previewTemplate && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Template Preview: {previewTemplate.label}</DialogTitle>
              <DialogDescription>Preview with sample data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-xs font-medium mb-1">In-App Preview</p>
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <p className="font-medium text-sm mb-1">
                    {substituteVariables(previewTemplate.subject, previewVariables)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {substituteVariables(previewTemplate.body, previewVariables)}
                  </p>
                </div>
              </div>
              {previewTemplate.channels.includes("whatsapp") && (
                <div>
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-green-600" />
                    WhatsApp Preview
                  </p>
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm">
                      {substituteVariables(previewTemplate.whatsappBody, previewVariables)}
                    </p>
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Sample Variables Used:</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(previewVariables).slice(0, 8).map(([key, val]) => (
                    <span key={key}>
                      <code className="bg-muted px-1 rounded">{`{{${key}}}`}</code> = {val}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
