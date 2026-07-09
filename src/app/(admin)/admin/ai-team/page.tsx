/* eslint-disable i18next/no-literal-string -- French-first AI dashboard UI strings */
"use client";

/**
 * AI Team Dashboard — Unified view of three AI agents:
 * Marketing, Support, and Reminder/Task agents.
 *
 * Each agent is displayed as a team member card with status,
 * recent actions, pending items, and suggestions. Cards expand
 * into a chat interface for interacting with individual agents.
 */

import {
  Bell,
  Bot,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { AITeamKanban, type TeamTask } from "@/components/admin/ai-team-kanban";
import { FeatureGate } from "@/components/feature-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

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
  metrics: Record<string, unknown>;
  pendingTasks: number;
  tasks: AgentTask[];
  alerts: AgentAlert[];
}

interface DashboardData {
  agents: {
    marketing: AgentData;
    support: AgentData;
    reminder: AgentData;
  };
  totalUnreadAlerts: number;
  teamTasks?: TeamTask[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  timestamp: Date;
  error?: boolean;
}

// ── Agent config ──

const AGENT_CONFIG = {
  marketing: {
    label: "Agent Marketing",
    icon: Megaphone,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    borderColor: "border-pink-200 dark:border-pink-800",
    description: "Rétention patient, campagnes WhatsApp, avis Google",
  },
  support: {
    label: "Agent Support",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Questions patients, satisfaction NPS, escalades",
  },
  reminder: {
    label: "Agent Rappels",
    icon: Calendar,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    description: "Tâches quotidiennes, échéances, alertes revenus",
  },
} as const;

// ── Priority badge ──

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${variants[priority] ?? variants.medium}`}
    >
      {priority}
    </span>
  );
}

// ── Severity icon ──

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Info className="h-3.5 w-3.5 text-blue-500" />;
  }
}

// ── Agent Card ──

function AgentCard({
  agentType,
  agentData,
  isExpanded,
  onToggle,
  onGenerateInsights,
  generating,
}: {
  agentType: AgentType;
  agentData: AgentData;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerateInsights: () => void;
  generating: boolean;
}) {
  const config = AGENT_CONFIG[agentType];
  const Icon = config.icon;

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || chatLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setChatInput("");
      setChatLoading(true);

      const conversationHistory = messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await fetch("/api/ai/team/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentType,
            message: text.trim(),
            conversationHistory,
          }),
        });

        const result = (await response.json()) as {
          ok: boolean;
          data?: {
            response: {
              answer: string;
              suggestions?: string[];
            };
          };
          error?: string;
        };

        if (!response.ok || !result.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: result.error ?? "Une erreur est survenue.",
              timestamp: new Date(),
              error: true,
            },
          ]);
          return;
        }

        const agentResponse = result.data?.response;
        if (!agentResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Réponse inattendue du serveur.",
              timestamp: new Date(),
              error: true,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: agentResponse.answer,
            suggestions: agentResponse.suggestions,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Impossible de contacter le serveur.",
            timestamp: new Date(),
            error: true,
          },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatLoading, messages, agentType],
  );

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(chatInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(chatInput);
    }
  };

  const metricsEntries = Object.entries(agentData.metrics).filter(
    ([, v]) => v !== null && v !== undefined,
  );

  return (
    <Card className={`transition-all duration-200 ${isExpanded ? "md:col-span-3" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bgColor}`}
            >
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-base">{config.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <div className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500" />
              Actif
            </Badge>
            {agentData.alerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {agentData.alerts.length}
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {metricsEntries.map(([key, value]) => (
            <div key={key} className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-[10px] text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </p>
              <p className="text-sm font-semibold">{String(value)}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onGenerateInsights}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Générer insights
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            {chatOpen ? "Fermer chat" : "Discuter"}
          </Button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="space-y-3 pt-2">
            {/* Tasks */}
            {agentData.tasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Tâches en cours ({agentData.tasks.length})
                </h4>
                <div className="space-y-1.5">
                  {agentData.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {agentData.alerts.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  Alertes ({agentData.alerts.length})
                </h4>
                <div className="space-y-1.5">
                  {agentData.alerts.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            )}

            {agentData.tasks.length === 0 && agentData.alerts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucune tâche ou alerte. Cliquez sur &quot;Générer insights&quot; pour analyser vos
                données.
              </p>
            )}
          </div>
        )}

        {/* Chat interface */}
        {chatOpen && (
          <div className="border rounded-lg mt-3">
            <ScrollArea ref={scrollRef} className="h-64 p-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <Bot className={`h-8 w-8 ${config.color}`} />
                  <p className="text-xs text-muted-foreground">
                    Posez une question à {config.label}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : msg.error
                              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                              : "bg-muted"
                        }`}
                      >
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.suggestions.map((s) => (
                              <div
                                key={`${msg.id}-suggestion-${s}`}
                                className="flex items-start gap-1 text-[10px] text-muted-foreground"
                              >
                                <Sparkles className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-xl px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            <form onSubmit={handleChatSubmit} className="flex gap-2 p-2 border-t">
              <Textarea
                ref={textareaRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Posez une question à ${config.label}...`}
                className="min-h-[36px] max-h-[72px] text-xs resize-none"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9"
                disabled={chatLoading || !chatInput.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Task item ──

function TaskItem({ task }: { task: AgentTask }) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await fetch("/api/ai/team/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status }),
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium truncate">{task.title}</p>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
            {task.description}
          </p>
        )}
        {task.due_date && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {new Date(task.due_date).toLocaleDateString("fr-FR")}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void updateStatus("completed")}
          disabled={updating}
          title="Marquer comme terminé"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void updateStatus("dismissed")}
          disabled={updating}
          title="Ignorer"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

// ── Alert item ──

function AlertItem({ alert }: { alert: AgentAlert }) {
  const [dismissed, setDismissed] = useState(false);

  const markAsRead = async () => {
    try {
      await fetch("/api/ai/team/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id }),
      });
      setDismissed(true);
    } catch {
      // silently fail
    }
  };

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border px-3 py-2">
      <SeverityIcon severity={alert.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{alert.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{alert.message}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => void markAsRead()}
        title="Marquer comme lu"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Notification bell ──

function NotificationBell({
  alerts,
  onDismissAll,
}: {
  alerts: AgentAlert[];
  onDismissAll: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (alerts.length === 0) {
    return (
      <Button variant="ghost" size="icon" className="relative h-9 w-9" disabled>
        <Bell className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
          {alerts.length}
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between p-3 border-b">
            <p className="text-sm font-medium">Alertes ({alerts.length})</p>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onDismissAll}>
              Tout marquer lu
            </Button>
          </div>
          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 rounded-md p-2 hover:bg-muted/50"
                >
                  <SeverityIcon severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{alert.title}</p>
                    <p className="text-[10px] text-muted-foreground">{alert.message}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {AGENT_CONFIG[alert.agent_type as AgentType]?.label ?? alert.agent_type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ── Main page ──

function AITeamDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [generatingAgent, setGeneratingAgent] = useState<AgentType | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/team/dashboard");
      const result = (await response.json()) as {
        ok: boolean;
        data?: DashboardData;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Erreur lors du chargement");
        return;
      }
      setDashboardData(result.data ?? null);
      setError(null);
    } catch {
      setError("Impossible de charger le tableau de bord IA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const generateInsights = async (agentType: AgentType) => {
    setGeneratingAgent(agentType);
    try {
      await fetch("/api/ai/team/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType }),
      });
      await fetchDashboard();
    } finally {
      setGeneratingAgent(null);
    }
  };

  const dismissAllAlerts = async () => {
    if (!dashboardData) return;
    const allAlerts = [
      ...dashboardData.agents.marketing.alerts,
      ...dashboardData.agents.support.alerts,
      ...dashboardData.agents.reminder.alerts,
    ];
    for (const alert of allAlerts) {
      try {
        await fetch("/api/ai/team/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertId: alert.id }),
        });
      } catch {
        // continue on error
      }
    }
    void fetchDashboard();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            void fetchDashboard();
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  }

  if (!dashboardData) return null;

  const allAlerts = [
    ...dashboardData.agents.marketing.alerts,
    ...dashboardData.agents.support.alerts,
    ...dashboardData.agents.reminder.alerts,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Équipe IA</h1>
            <p className="text-xs text-muted-foreground">
              Votre équipe virtuelle d&apos;agents IA pour gérer votre clinique
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Les agents actifs au quotidien de votre clinique (Marketing, Support, Rappels). Le
              catalogue des capacités IA de la plateforme se trouve dans «&nbsp;AI Agents&nbsp;»
              côté super-admin.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell alerts={allAlerts} onDismissAll={() => void dismissAllAlerts()} />
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              setLoading(true);
              void fetchDashboard();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* AI disclaimer */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
        <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Les agents IA fournissent des suggestions basées sur vos données. Vérifiez toujours avant
          d&apos;agir.
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["marketing", "support", "reminder"] as const).map((agentType) => (
          <AgentCard
            key={agentType}
            agentType={agentType}
            agentData={dashboardData.agents[agentType]}
            isExpanded={expandedAgent === agentType}
            onToggle={() => setExpandedAgent(expandedAgent === agentType ? null : agentType)}
            onGenerateInsights={() => void generateInsights(agentType)}
            generating={generatingAgent === agentType}
          />
        ))}
      </div>

      {/* C3: Kanban board for durable team tasks */}
      {(dashboardData.teamTasks ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Tableau des tâches</h2>
            <Badge variant="secondary" className="text-[10px]">
              {(dashboardData.teamTasks ?? []).length}
            </Badge>
          </div>
          <AITeamKanban
            tasks={dashboardData.teamTasks ?? []}
            onRefresh={() => {
              setLoading(true);
              void fetchDashboard();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Export with feature gate ──

export default function AITeamPage() {
  return (
    <FeatureGate featureKey="ai_manager" moduleName="Équipe IA">
      <AITeamDashboard />
    </FeatureGate>
  );
}
