"use client";
/* eslint-disable i18next/no-literal-string -- Internal/super-admin-only surface or English-first form. The FR/AR translation backlog will catch up; do not add these strings to the i18n keyset now. */

import {
  ArrowLeft,
  Clock,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  User,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  channel: string;
  language: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  sla_target_hours: number;
  sla_breached: boolean;
  first_response_at: string | null;
  ai_category: string | null;
  ai_priority: string | null;
  ai_draft_response: string | null;
  triaged_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_type: "patient" | "staff" | "bot";
  sender_id: string | null;
  content: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-800",
};

function SenderIcon({ senderType }: { senderType: string }) {
  if (senderType === "bot") return <Bot className="h-4 w-4 text-violet-600" />;
  if (senderType === "patient") return <User className="h-4 w-4 text-blue-600" />;
  return <User className="h-4 w-4 text-green-700" />;
}

function MessageBubble({ message }: { message: Message }) {
  const isStaff = message.sender_type === "staff";
  const isBot = message.sender_type === "bot";

  return (
    <div className={`flex gap-3 ${isStaff || isBot ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isStaff ? "bg-green-100" : isBot ? "bg-violet-100" : "bg-blue-100"
        }`}
      >
        <SenderIcon senderType={message.sender_type} />
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
          isStaff
            ? "bg-green-50 border border-green-200 rounded-tr-sm"
            : isBot
              ? "bg-violet-50 border border-violet-200 rounded-tr-sm"
              : "bg-muted border rounded-tl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="mt-1 text-[10px] text-muted-foreground text-right">
          {new Date(message.created_at).toLocaleString("fr-MA")}
          {isBot && " · AI"}
        </p>
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTicket = useCallback(async () => {
    try {
      const [ticketRes, msgsRes] = await Promise.all([
        fetch(`/api/support/tickets?id=${ticketId}`, { cache: "no-store" }),
        fetch(`/api/support/tickets/message?ticket_id=${ticketId}`, { cache: "no-store" }),
      ]);

      if (ticketRes.ok) {
        const ticketJson = (await ticketRes.json()) as {
          ok?: boolean;
          data?: { tickets?: Ticket[]; ticket?: Ticket };
        };
        const tickets = ticketJson.data?.tickets ?? [];
        const found = tickets.find((t: Ticket) => t.id === ticketId) ?? ticketJson.data?.ticket;
        if (found) setTicket(found as Ticket);
      }

      if (msgsRes.ok) {
        const msgsJson = (await msgsRes.json()) as {
          ok?: boolean;
          data?: { messages?: Message[] };
        };
        setMessages(msgsJson.data?.messages ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !ticket) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          content: reply.trim(),
          sender_type: "staff",
        }),
      });
      if (!res.ok) {
        setError("Impossible d'envoyer le message.");
        return;
      }
      setReply("");
      await loadTicket();
    } finally {
      setSending(false);
    }
  }

  async function handleTriage() {
    if (!ticket) return;
    setTriaging(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      if (!res.ok) {
        setError("Triage AI indisponible.");
        return;
      }
      await loadTicket();
    } finally {
      setTriaging(false);
    }
  }

  async function handleStatusUpdate(status: string) {
    if (!ticket) return;
    const res = await fetch("/api/support/tickets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId, status }),
    });
    if (res.ok) await loadTicket();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Support", href: "/admin/support" }, { label: "Ticket" }]} />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Support", href: "/admin/support" }, { label: "Ticket" }]} />
        <p className="text-muted-foreground">Ticket not found.</p>
        <Link href="/admin/support">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to support
          </Button>
        </Link>
      </div>
    );
  }

  const hoursOpen = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 3_600_000);

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Support", href: "/admin/support" },
          { label: ticket.subject.slice(0, 40) },
        ]}
      />

      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/admin/support">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className={STATUS_COLORS[ticket.status]}>
              {ticket.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>
              {ticket.priority}
            </Badge>
            {ticket.sla_breached && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" />
                SLA Breached
              </Badge>
            )}
            {ticket.ai_category && (
              <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700">
                AI: {ticket.ai_category}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTriage} disabled={triaging}>
            <Sparkles className={`h-4 w-4 mr-1 ${triaging ? "animate-spin" : ""}`} />
            {triaging ? "Triaging..." : "AI Triage"}
          </Button>
          {ticket.status !== "resolved" && ticket.status !== "closed" && (
            <Button variant="outline" size="sm" onClick={() => handleStatusUpdate("resolved")}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
        <div className="space-y-4">
          {/* Thread */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

          {/* AI Draft */}
          {ticket.ai_draft_response && (
            <Card className="border-violet-200 bg-violet-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-violet-700">
                  <Sparkles className="h-4 w-4" />
                  AI Suggested Reply
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-violet-900 whitespace-pre-wrap">
                  {ticket.ai_draft_response}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setReply(ticket.ai_draft_response ?? "")}
                >
                  Use as reply
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Reply box */}
          {ticket.status !== "closed" && (
            <div className="space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                className="resize-none"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    void handleSend();
                  }
                }}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Ctrl+Enter to send</p>
                <Button onClick={() => void handleSend()} disabled={!reply.trim() || sending}>
                  <Send className="h-4 w-4 mr-1" />
                  {sending ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ticket info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {ticket.patient_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient</span>
                  <span>{ticket.patient_name}</span>
                </div>
              )}
              {ticket.patient_phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{ticket.patient_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span className="capitalize">{ticket.channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language</span>
                <span>{ticket.language ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(ticket.created_at).toLocaleDateString("fr-MA")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open</span>
                <span
                  className={`flex items-center gap-1 ${ticket.sla_breached ? "text-destructive" : ""}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {hoursOpen}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SLA target</span>
                <span>{ticket.sla_target_hours}h</span>
              </div>
              {ticket.first_response_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First response</span>
                  <span>
                    {Math.round(
                      (new Date(ticket.first_response_at).getTime() -
                        new Date(ticket.created_at).getTime()) /
                        3_600_000,
                    )}
                    h
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {ticket.triaged_at && (
            <Card className="border-violet-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-violet-700">AI Triage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>{ticket.ai_category ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI priority</span>
                  <span className="capitalize">{ticket.ai_priority ?? "—"}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Triaged {new Date(ticket.triaged_at).toLocaleDateString("fr-MA")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Status actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ticket.status === "open" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleStatusUpdate("in_progress")}
                >
                  Mark In Progress
                </Button>
              )}
              {ticket.status !== "closed" && ticket.status !== "resolved" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleStatusUpdate("resolved")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
              )}
              {ticket.status === "resolved" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleStatusUpdate("closed")}
                >
                  Close Ticket
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
