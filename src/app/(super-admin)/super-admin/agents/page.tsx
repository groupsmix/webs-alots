"use client";

import { Bot, MessageSquare, Stethoscope, Receipt, BarChart3, Heart, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";

type AgentStatus = "active" | "coming_soon";
type AgentCategory = "Communication" | "Clinical" | "Finance" | "Analytics";
type CategoryFilter = "All" | AgentCategory;

interface AgentDef {
  id: string;
  name: string;
  description: string;
  icon: typeof Bot;
  status: AgentStatus;
  category: AgentCategory;
}

const platformAgents: AgentDef[] = [
  {
    id: "appointment-booking",
    name: "Appointment Booking Bot",
    description: "Handles patient booking via WhatsApp/chat",
    icon: Bot,
    status: "active",
    category: "Communication",
  },
  {
    id: "whatsapp-responder",
    name: "WhatsApp Auto-Responder",
    description: "Sends automated responses and reminders",
    icon: MessageSquare,
    status: "active",
    category: "Communication",
  },
  {
    id: "triage-assistant",
    name: "Triage Assistant",
    description: "Helps patients describe symptoms before visit",
    icon: Stethoscope,
    status: "coming_soon",
    category: "Clinical",
  },
  {
    id: "billing-assistant",
    name: "Billing Assistant",
    description: "Automates invoice generation and payment reminders",
    icon: Receipt,
    status: "active",
    category: "Finance",
  },
  {
    id: "report-generator",
    name: "Report Generator",
    description: "Creates clinic performance reports",
    icon: BarChart3,
    status: "active",
    category: "Analytics",
  },
  {
    id: "patient-followup",
    name: "Patient Follow-up",
    description: "Sends post-visit follow-up messages",
    icon: Heart,
    status: "coming_soon",
    category: "Communication",
  },
];

const categories: CategoryFilter[] = ["All", "Communication", "Clinical", "Finance", "Analytics"];

const statusConfig: Record<AgentStatus, { label: string; className: string }> = {
  active: {
    label: "Available",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
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
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("All");
  const [clinicCount, setClinicCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/super-admin/usage")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.ok) {
          setClinicCount(json.data.clinics?.length ?? 0);
        }
      })
      .catch((err) => {
        logger.warn("Failed to load agent stats", { context: "agents-page", error: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = platformAgents.filter((agent) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q || agent.name.toLowerCase().includes(q) || agent.description.toLowerCase().includes(q);
    return matchSearch && (catFilter === "All" || agent.category === catFilter);
  });

  const totalAgents = filtered.length;
  const activeAgents = filtered.filter((a) => a.status === "active").length;

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "AI Agents" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform AI capabilities available to {clinicCount > 0 ? clinicCount : "all"} clinics
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This is the platform-wide capability catalogue (what AI features exist and their rollout
            status). For the live per-clinic AI team that runs day to day (Marketing, Support,
            Reminder), see <span className="font-medium">AI Team</span> in the clinic admin area.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{totalAgents}</p>
            <p className="text-xs text-muted-foreground">Total Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-700">{activeAgents}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-muted-foreground">{totalAgents - activeAgents}</p>
            <p className="text-xs text-muted-foreground">Coming Soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-10"
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              if (val.trim()) setCatFilter("All");
            }}
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

      {/* Agent Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{agent.name}</CardTitle>
                      <Badge className={`text-[10px] mt-1 ${categoryColors[agent.category]}`}>
                        {agent.category}
                      </Badge>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${statusConfig[agent.status].className}`}>
                    {statusConfig[agent.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            No agents match your search.
          </div>
        )}
      </div>
    </div>
  );
}
