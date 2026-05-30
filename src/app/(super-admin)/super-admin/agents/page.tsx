"use client";

import {
  Bot,
  MessageSquare,
  Stethoscope,
  Receipt,
  BarChart3,
  Heart,
  Search,
  Activity,
  CheckCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

type AgentStatus = "active" | "paused" | "coming_soon";
type AgentCategory = "Communication" | "Clinical" | "Finance" | "Analytics";
type CategoryFilter = "All" | AgentCategory;

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: typeof Bot;
  status: AgentStatus;
  category: AgentCategory;
  clinicsUsing: number;
  messagesToday: number;
  enabled: boolean;
}

const initialAgents: Agent[] = [
  {
    id: "appointment-booking",
    name: "Appointment Booking Bot",
    description: "Handles patient booking via WhatsApp/chat",
    icon: Bot,
    status: "active",
    category: "Communication",
    clinicsUsing: 27,
    messagesToday: 48,
    enabled: true,
  },
  {
    id: "whatsapp-responder",
    name: "WhatsApp Auto-Responder",
    description: "Sends automated responses and reminders",
    icon: MessageSquare,
    status: "active",
    category: "Communication",
    clinicsUsing: 34,
    messagesToday: 62,
    enabled: true,
  },
  {
    id: "triage-assistant",
    name: "Triage Assistant",
    description: "Helps patients describe symptoms before visit",
    icon: Stethoscope,
    status: "coming_soon",
    category: "Clinical",
    clinicsUsing: 0,
    messagesToday: 0,
    enabled: false,
  },
  {
    id: "billing-assistant",
    name: "Billing Assistant",
    description: "Automates invoice generation and payment reminders",
    icon: Receipt,
    status: "active",
    category: "Finance",
    clinicsUsing: 19,
    messagesToday: 18,
    enabled: true,
  },
  {
    id: "report-generator",
    name: "Report Generator",
    description: "Creates clinic performance reports",
    icon: BarChart3,
    status: "active",
    category: "Analytics",
    clinicsUsing: 22,
    messagesToday: 14,
    enabled: true,
  },
  {
    id: "patient-followup",
    name: "Patient Follow-up",
    description: "Sends post-visit follow-up messages",
    icon: Heart,
    status: "coming_soon",
    category: "Communication",
    clinicsUsing: 0,
    messagesToday: 0,
    enabled: false,
  },
];

const categories: CategoryFilter[] = ["All", "Communication", "Clinical", "Finance", "Analytics"];

const statusConfig: Record<AgentStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  coming_soon: {
    label: "Coming Soon",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

const categoryColors: Record<AgentCategory, string> = {
  Communication: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Clinical: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Finance: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Analytics: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function AIAgentsPage() {
  const { addToast } = useToast();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("All");

  const filtered = agents.filter((agent) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || agent.name.toLowerCase().includes(q) || agent.description.toLowerCase().includes(q);
    return matchSearch && (catFilter === "All" || agent.category === catFilter);
  });

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const messagesToday = agents.reduce((sum, a) => sum + a.messagesToday, 0);
  const tasksCompleted = 89;

  function handleToggle(agentId: string) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    if (agent.status === "coming_soon") {
      addToast("This agent is coming soon and cannot be enabled yet", "info");
      return;
    }

    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, enabled: !a.enabled } : a)));
    addToast(`${agent.name} ${agent.enabled ? "disabled" : "enabled"}`, "success");
  }

  const kpis = [
    {
      icon: Bot,
      label: "Total Agents",
      value: totalAgents.toString(),
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      icon: Activity,
      label: "Active",
      value: activeAgents.toString(),
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      icon: MessageSquare,
      label: "Messages Today",
      value: messagesToday.toString(),
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      icon: CheckCircle,
      label: "Tasks Completed",
      value: tasksCompleted.toString(),
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "AI Agents" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <h1 className="text-2xl font-bold">AI Agents</h1>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <p className="text-sm text-muted-foreground mt-1">
            Manage and monitor your platform AI agents
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((c) => (
            <Button
              key={c}
              variant={catFilter === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCatFilter(c)}
              className="text-xs"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent) => {
          const statusCfg = statusConfig[agent.status];
          return (
            <Card
              key={agent.id}
              className={agent.status === "coming_soon" ? "opacity-75" : undefined}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <agent.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm leading-tight">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className={statusCfg.className}>
                    {statusCfg.label}
                  </Badge>
                  <Badge variant="outline" className={categoryColors[agent.category]}>
                    {agent.category}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-lg font-bold">{agent.clinicsUsing}</p>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <p className="text-[10px] text-muted-foreground">clinics</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-lg font-bold">{agent.messagesToday}</p>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <p className="text-[10px] text-muted-foreground">msgs today</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {agent.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <Switch
                    checked={agent.enabled}
                    onCheckedChange={() => handleToggle(agent.id)}
                    disabled={agent.status === "coming_soon"}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <h3 className="text-lg font-medium">No agents found</h3>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
