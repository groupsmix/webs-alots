/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */
"use client";

import {
  LifeBuoy,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";

interface SupportTicket {
  id: string;
  clinic_id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  created_by: string | null;
  assigned_to: string | null;
  assigned_team_member_id: string | null;
  assigned_team_member_name: string | null;
  assigned_team_member_role: string | null;
  ai_priority: "critical" | "high" | "medium" | "low" | null;
  ai_category: string | null;
  sentiment: "frustrated" | "neutral" | "satisfied" | null;
  ai_draft_response: string | null;
  triaged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  clinics: { name: string } | null;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_type: "clinic" | "admin" | "system";
  message: string;
  created_at: string;
}

type StatusFilter = "all" | "open" | "in_progress" | "resolved" | "closed";
type PriorityFilter = "all" | "low" | "medium" | "high" | "urgent";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function statusBadgeVariant(status: string): "default" | "warning" | "success" | "secondary" {
  switch (status) {
    case "open":
      return "default";
    case "in_progress":
      return "warning";
    case "resolved":
      return "success";
    case "closed":
      return "secondary";
    default:
      return "secondary";
  }
}

function priorityBadgeVariant(
  priority: string,
): "secondary" | "default" | "warning" | "destructive" {
  switch (priority) {
    case "low":
      return "secondary";
    case "medium":
      return "default";
    case "high":
      return "warning";
    case "urgent":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

export default function SupportPage() {
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [triageLoadingId, setTriageLoadingId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/support?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setTickets(json.data.tickets);
      } else {
        logger.warn("Failed to load tickets", { context: "support-page", error: json.error });
      }
    } catch (err) {
      logger.warn("Failed to load tickets", { context: "support-page", error: err });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    const controller = new AbortController();
    loadTickets();
    return () => {
      controller.abort();
    };
  }, [loadTickets]);

  const loadMessages = useCallback(async (ticketId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/admin/support/messages?ticket_id=${ticketId}`);
      const json = await res.json();
      if (json.ok) {
        setMessages(json.data.messages);
      }
    } catch (err) {
      logger.warn("Failed to load messages", { context: "support-page", error: err });
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  function handleExpandTicket(ticketId: string) {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      setMessages([]);
      return;
    }
    setExpandedTicketId(ticketId);
    loadMessages(ticketId);
  }

  async function handleReply(ticketId: string) {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch("/api/admin/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          message: replyText.trim(),
          sender_type: "admin",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setReplyText("");
        addToast("Reply sent", "success");
        loadMessages(ticketId);
      } else {
        addToast("Failed to send reply", "error");
      }
    } catch {
      addToast("Failed to send reply", "error");
    } finally {
      setReplySending(false);
    }
  }

  async function handleStatusChange(ticketId: string, newStatus: string) {
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast(`Status changed to ${STATUS_LABELS[newStatus] ?? newStatus}`, "success");
        loadTickets();
      } else {
        addToast("Failed to update status", "error");
      }
    } catch {
      addToast("Failed to update status", "error");
    }
  }

  async function handlePriorityChange(ticketId: string, newPriority: string) {
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId, priority: newPriority }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast(`Priority changed to ${PRIORITY_LABELS[newPriority] ?? newPriority}`, "success");
        loadTickets();
      } else {
        addToast("Failed to update priority", "error");
      }
    } catch {
      addToast("Failed to update priority", "error");
    }
  }

  async function handleTriage(ticketId: string) {
    setTriageLoadingId(ticketId);
    try {
      const res = await fetch("/api/admin/support/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast("AI triage completed", "success");
        await loadTickets();
      } else {
        addToast(json.error ?? "Failed to triage ticket", "error");
      }
    } catch {
      addToast("Failed to triage ticket", "error");
    } finally {
      setTriageLoadingId(null);
    }
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedTodayCount = tickets.filter((t) => {
    if (!t.resolved_at) return false;
    const resolved = new Date(t.resolved_at);
    const today = new Date();
    return (
      resolved.getFullYear() === today.getFullYear() &&
      resolved.getMonth() === today.getMonth() &&
      resolved.getDate() === today.getDate()
    );
  }).length;

  const filtered = tickets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const clinicName = t.clinics?.name?.toLowerCase() ?? "";
    return t.subject.toLowerCase().includes(q) || clinicName.includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Support" }]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage clinic support requests and conversations
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
            <p className="text-2xl font-bold">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <p className="text-2xl font-bold">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </div>
            <p className="text-2xl font-bold">N/A</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Resolved Today</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{resolvedTodayCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject or clinic name..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "open", "in_progress", "resolved", "closed"] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {s === "all" ? "All Status" : (STATUS_LABELS[s] ?? s)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "low", "medium", "high", "urgent"] as PriorityFilter[]).map((p) => (
            <Button
              key={p}
              variant={priorityFilter === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPriorityFilter(p)}
              className="text-xs"
            >
              {p === "all" ? "All Priority" : (PRIORITY_LABELS[p] ?? p)}
            </Button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <LifeBuoy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No support tickets</h3>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "No tickets match your current filters. Try adjusting your search or filters."
                : "No support tickets have been created yet. Tickets from clinics will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleExpandTicket(ticket.id)}
                        className="font-semibold text-sm truncate hover:underline text-left"
                      >
                        {ticket.subject}
                      </button>
                      <Badge variant={statusBadgeVariant(ticket.status)} className="text-[10px]">
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </Badge>
                      <Badge
                        variant={priorityBadgeVariant(ticket.priority)}
                        className="text-[10px]"
                      >
                        {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                      </Badge>
                      {ticket.ai_priority ? (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          AI {ticket.ai_priority}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{ticket.clinics?.name ?? "Unknown Clinic"}</span>
                      <span>{formatDate(ticket.created_at)}</span>
                      {ticket.updated_at !== ticket.created_at && (
                        <span>Updated {formatDate(ticket.updated_at)}</span>
                      )}
                      {ticket.assigned_team_member_name ? (
                        <span>Assignee: {ticket.assigned_team_member_name}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {ticket.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(ticket.id, "in_progress")}
                        className="text-xs"
                      >
                        Start
                      </Button>
                    )}
                    {ticket.status === "in_progress" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(ticket.id, "resolved")}
                        className="text-xs"
                      >
                        Resolve
                      </Button>
                    )}
                    {ticket.priority !== "urgent" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const priorities = ["low", "medium", "high", "urgent"];
                          const idx = priorities.indexOf(ticket.priority);
                          if (idx < priorities.length - 1) {
                            handlePriorityChange(ticket.id, priorities[idx + 1]);
                          }
                        }}
                        title="Increase priority"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTriage(ticket.id)}
                      disabled={triageLoadingId === ticket.id}
                      title="Run AI triage"
                    >
                      {triageLoadingId === ticket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                    {ticket.priority !== "low" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const priorities = ["low", "medium", "high", "urgent"];
                          const idx = priorities.indexOf(ticket.priority);
                          if (idx > 0) {
                            handlePriorityChange(ticket.id, priorities[idx - 1]);
                          }
                        }}
                        title="Decrease priority"
                      >
                        <ArrowDownCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleExpandTicket(ticket.id)}>
                      {expandedTicketId === ticket.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded conversation thread */}
                {expandedTicketId === ticket.id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="mb-3">
                      <p className="text-sm font-medium mb-1">Description</p>
                      <p className="text-sm text-muted-foreground">{ticket.description}</p>
                    </div>

                    {(ticket.ai_priority ||
                      ticket.ai_draft_response ||
                      ticket.assigned_team_member_name) && (
                      <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">AI triage</p>
                          {ticket.triaged_at ? (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(ticket.triaged_at)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2 text-xs">
                          {ticket.ai_priority ? (
                            <Badge variant="outline" className="capitalize">
                              Priority: {ticket.ai_priority}
                            </Badge>
                          ) : null}
                          {ticket.ai_category ? (
                            <Badge variant="outline" className="capitalize">
                              Category: {ticket.ai_category}
                            </Badge>
                          ) : null}
                          {ticket.sentiment ? (
                            <Badge variant="outline" className="capitalize">
                              Sentiment: {ticket.sentiment}
                            </Badge>
                          ) : null}
                          {ticket.assigned_team_member_name ? (
                            <Badge variant="outline">
                              Assigned: {ticket.assigned_team_member_name}
                            </Badge>
                          ) : null}
                        </div>
                        {ticket.ai_draft_response ? (
                          <div>
                            <p className="text-xs font-medium mb-1">Suggested reply</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">
                              {ticket.ai_draft_response}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => setReplyText(ticket.ai_draft_response ?? "")}
                            >
                              Use draft response
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="mb-3">
                      <p className="text-sm font-medium mb-2">Conversation</p>
                      {messagesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No messages yet. Send a reply to start the conversation.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`rounded-lg p-3 text-sm ${
                                msg.sender_type === "admin"
                                  ? "bg-primary/5 border-l-2 border-primary"
                                  : msg.sender_type === "system"
                                    ? "bg-muted text-muted-foreground italic"
                                    : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-xs capitalize">
                                  {msg.sender_type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(msg.created_at)}
                                </span>
                              </div>
                              <p>{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reply form */}
                    {ticket.status !== "closed" && (
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type your reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <Button
                          onClick={() => handleReply(ticket.id)}
                          disabled={replySending || !replyText.trim()}
                          className="self-end"
                        >
                          {replySending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Status change buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground mr-1">Set status:</span>
                      {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
                        <Button
                          key={s}
                          variant={ticket.status === s ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleStatusChange(ticket.id, s)}
                          disabled={ticket.status === s}
                          className="text-xs"
                        >
                          {STATUS_LABELS[s]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
