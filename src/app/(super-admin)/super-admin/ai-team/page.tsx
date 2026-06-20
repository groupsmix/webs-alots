/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  Bot,
  MessageSquare,
  Bell,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  Send,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";

// ── Types ──

type AgentType = "marketing" | "support" | "reminder";

interface AgentTask {
  id: string;
  agent_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string | null;
  due_date: string | null;
  created_at: string;
}

interface AgentAlert {
  id: string;
  agent_type: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}

interface AgentData {
  status: string;
  label: string;
  metrics: Record<string, number>;
  pendingTasks: number;
  tasks: AgentTask[];
  alerts: AgentAlert[];
}

interface DashboardData {
  agents: Record<AgentType, AgentData>;
  totalUnreadAlerts: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Agent metadata ──

const AGENT_META: Record<AgentType, { icon: typeof Bot; color: string; description: string }> = {
  marketing: {
    icon: TrendingUp,
    color: "text-blue-500",
    description: "Engage inactive patients, birthday campaigns, growth tracking",
  },
  support: {
    icon: Users,
    color: "text-green-500",
    description: "NPS monitoring, queue management, patient satisfaction",
  },
  reminder: {
    icon: Calendar,
    color: "text-orange-500",
    description: "Appointment reminders, follow-ups, revenue tracking",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: Bell,
  info: CheckCircle,
};

export default function AITeamPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<AgentType | null>(null);
  const [activeChat, setActiveChat] = useState<AgentType | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const { addToast } = useToast();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/team/dashboard");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = (await res.json()) as { ok: boolean; data?: DashboardData };
      if (json.ok && json.data) {
        setDashboard(json.data);
      }
    } catch (err) {
      logger.error("Failed to load AI team dashboard", { context: "ai-team-page", error: err });
      addToast("Failed to load AI team data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const handleGenerate = async (agentType: AgentType) => {
    setGenerating(agentType);
    try {
      const res = await fetch("/api/ai/team/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to generate");
      }
      addToast(`${AGENT_META[agentType].description} updated`, "success");
      await fetchDashboard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate insights";
      addToast(msg, "error");
    } finally {
      setGenerating(null);
    }
  };

  const handleChat = async (agentType: AgentType) => {
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/team/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType,
          message: userMsg.content,
          conversationHistory: chatMessages.slice(-10),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Chat failed");
      }

      const json = (await res.json()) as { ok: boolean; data?: { response: { answer: string } } };
      if (json.ok && json.data) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: json.data!.response.answer },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat failed";
      addToast(msg, "error");
    } finally {
      setChatLoading(false);
    }
  };

  const handleTaskUpdate = async (taskId: string, status: string) => {
    try {
      const res = await fetch("/api/ai/team/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      addToast(`Task status changed to ${status}`, "success");
      await fetchDashboard();
    } catch {
      addToast("Failed to update task", "error");
    }
  };

  const handleAlertRead = async (alertId: string) => {
    try {
      const res = await fetch("/api/ai/team/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      if (!res.ok) throw new Error("Failed to mark alert as read");
      await fetchDashboard();
    } catch {
      addToast("Failed to update alert", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Super Admin", href: "/super-admin" }, { label: "AI Team" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Team Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your AI agents — marketing, support, and reminders
          </p>
        </div>
        {dashboard && (
          <Badge variant="outline" className="text-sm">
            <Bell className="mr-1 h-3.5 w-3.5" />
            {dashboard.totalUnreadAlerts} unread alerts
          </Badge>
        )}
      </div>

      {/* Agent Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {(["marketing", "support", "reminder"] as AgentType[]).map((agentType) => {
          const meta = AGENT_META[agentType];
          const agent = dashboard?.agents[agentType];
          const Icon = meta.icon;

          return (
            <Card key={agentType} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                    <CardTitle className="text-lg">{agent?.label ?? agentType}</CardTitle>
                  </div>
                  <Badge
                    variant={agent?.status === "active" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {agent?.status ?? "inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics */}
                {agent?.metrics && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(agent.metrics).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-lg font-semibold">{value}</p>
                        <p className="text-xs text-muted-foreground">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks count */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending tasks</span>
                  <Badge variant="outline">{agent?.pendingTasks ?? 0}</Badge>
                </div>

                {/* Alerts count */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Alerts</span>
                  <Badge variant={agent?.alerts.length ? "destructive" : "outline"}>
                    {agent?.alerts.length ?? 0}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setActiveChat(activeChat === agentType ? null : agentType);
                      setChatMessages([]);
                    }}
                    disabled={agent?.status !== "active"}
                    title={agent?.status !== "active" ? "Agent is inactive" : undefined}
                  >
                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                    Chat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => void handleGenerate(agentType)}
                    disabled={generating !== null || agent?.status !== "active"}
                    title={agent?.status !== "active" ? "Agent is inactive" : undefined}
                  >
                    {generating === agentType ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chat Panel */}
      {activeChat && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Chat with {dashboard?.agents[activeChat]?.label ?? activeChat}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setActiveChat(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-4">
              {chatMessages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Ask the {activeChat} agent a question about your clinic data...
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={`Ask the ${activeChat} agent...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleChat(activeChat);
                  }
                }}
                disabled={chatLoading}
              />
              <Button
                size="icon"
                onClick={() => void handleChat(activeChat)}
                disabled={chatLoading || !chatInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks & Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!dashboard || Object.values(dashboard.agents).every((a) => a.tasks.length === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No pending tasks. Click &quot;Generate&quot; on an agent to create some.
                </p>
              ) : (
                Object.values(dashboard.agents)
                  .flatMap((a) => a.tasks)
                  .slice(0, 10)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={PRIORITY_COLORS[task.priority] ?? ""} variant="outline">
                            {task.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {task.agent_type}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-2 flex gap-1">
                        {task.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleTaskUpdate(task.id, "in_progress")}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleTaskUpdate(task.id, "completed")}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Unread Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!dashboard || Object.values(dashboard.agents).every((a) => a.alerts.length === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No unread alerts</p>
              ) : (
                Object.values(dashboard.agents)
                  .flatMap((a) => a.alerts)
                  .slice(0, 10)
                  .map((alert) => {
                    const SevIcon = SEVERITY_ICONS[alert.severity] ?? Bell;
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between rounded-lg border p-3"
                      >
                        <div className="flex min-w-0 gap-2">
                          <SevIcon
                            className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                              alert.severity === "critical"
                                ? "text-red-500"
                                : alert.severity === "warning"
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{alert.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {alert.message}
                            </p>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {alert.agent_type}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleAlertRead(alert.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
