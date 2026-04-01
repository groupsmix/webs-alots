"use client";

/**
 * AI Manager — Smart Dashboard Assistant
 *
 * Chat interface allowing clinic admins to ask natural language questions
 * about their business data (revenue, appointments, patients, staff).
 * Feature-gated to Professional+ plan via "ai_manager" flag.
 */

import {
  Brain,
  Send,
  Loader2,
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──

interface DataPoint {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

interface AiManagerResponse {
  answer: string;
  dataPoints: DataPoint[];
  suggestions: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  dataPoints?: DataPoint[];
  suggestions?: string[];
  timestamp: Date;
  error?: boolean;
}

// ── Quick questions ──

const QUICK_QUESTIONS = [
  {
    label: "Résumé de la semaine",
    question: "Comment s'est passée cette semaine ?",
    icon: Calendar,
  },
  {
    label: "Rapport de revenus",
    question: "Quel est le résumé des revenus de ce mois ?",
    icon: TrendingUp,
  },
  {
    label: "Meilleur médecin",
    question: "Qui est mon médecin le plus performant ?",
    icon: Users,
  },
  {
    label: "Service populaire",
    question: "Quel est mon service le plus populaire ?",
    icon: BarChart3,
  },
  {
    label: "Analyse no-shows",
    question: "Combien de rendez-vous manqués ce mois-ci et quelles sont les tendances ?",
    icon: AlertTriangle,
  },
  {
    label: "Patients inactifs",
    question: "Quels patients n'ont pas visité depuis plus de 3 mois ?",
    icon: Users,
  },
] as const;

// ── Data point card ──

function DataPointCard({ point }: { point: DataPoint }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
      <span className="text-sm text-muted-foreground">{point.label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold">{point.value}</span>
        {point.trend === "up" && (
          <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        )}
        {point.trend === "down" && (
          <TrendingUp className="h-3.5 w-3.5 rotate-180 text-red-600 dark:text-red-400" />
        )}
      </div>
    </div>
  );
}

// ── Chat message bubble ──

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : message.error
              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              : "bg-muted"
        }`}
      >
        {!isUser && !message.error && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
              AI Manager
            </span>
          </div>
        )}

        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

        {/* Data points */}
        {message.dataPoints && message.dataPoints.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {message.dataPoints.map((point, i) => (
              <DataPointCard key={i} point={point} />
            ))}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Suggestions:
            </span>
            <ul className="space-y-1">
              {message.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-violet-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <span className="mt-1 block text-[10px] opacity-50">
          {message.timestamp.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Main page component ──

function AiManagerChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      // Build conversation history from previous messages (max 20)
      const conversationHistory = messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await fetch("/api/ai/manager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.trim(),
            conversationHistory,
          }),
        });

        const result = (await response.json()) as {
          ok: boolean;
          data?: { insight: AiManagerResponse };
          error?: string;
        };

        if (!response.ok || !result.ok) {
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.error ?? "Une erreur est survenue. Veuillez réessayer.",
            timestamp: new Date(),
            error: true,
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        const insight = result.data?.insight;
        if (!insight) {
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Réponse inattendue du serveur.",
            timestamp: new Date(),
            error: true,
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: insight.answer,
          dataPoints: insight.dataPoints,
          suggestions: insight.suggestions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Impossible de contacter le serveur. Veuillez réessayer.",
          timestamp: new Date(),
          error: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Manager</h1>
            <p className="text-xs text-muted-foreground">
              Posez des questions sur votre activité en langage naturel
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearChat}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Effacer
          </Button>
        )}
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 ? (
            /* Empty state with quick questions */
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
                  <Brain className="h-7 w-7 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold mb-1">
                  Bienvenue dans AI Manager
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Posez n&apos;importe quelle question sur votre clinique — revenus,
                  rendez-vous, patients, performance des médecins, et plus encore.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-2xl">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => void sendMessage(q.question)}
                    disabled={loading}
                    className="flex items-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <q.icon className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                    <span className="text-sm text-muted-foreground">
                      Analyse en cours...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <CardContent className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question sur votre clinique..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !input.trim()}
              className="h-[44px] px-4 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {/* Quick questions in chat mode */}
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_QUESTIONS.slice(0, 3).map((q) => (
                <Badge
                  key={q.label}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted transition-colors text-xs"
                  onClick={() => void sendMessage(q.question)}
                >
                  {q.label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page export with feature gate ──

export default function AiManagerPage() {
  return (
    <FeatureGate featureKey="ai_manager" moduleName="AI Manager">
      <AiManagerChat />
    </FeatureGate>
  );
}
