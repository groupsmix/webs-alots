"use client";

/* eslint-disable i18next/no-literal-string -- Role-specific AI assistant UX copy is colocated here while this beta surface is introduced. */
import { Bot, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentDebugPanel } from "@/components/ai/AgentDebugPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/ui/chat";
import { PromptSuggestions } from "@/components/ui/prompt-suggestions";
import type { SiteTeamAgentType } from "@/lib/ai/prompts";
import { getAgentApiBodyConfig, getAgentRoleConfig } from "@/lib/config/agent.config";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const ROLE_PROMPTS: Record<SiteTeamAgentType, string[]> = {
  doctor: ["📅 Mes RDV d'aujourd'hui", "💊 Info médicament", "👤 Chercher un patient"],
  secretary: ["📋 Planning du jour", "✍️ Rédiger un rappel WhatsApp", "🕐 Créneaux disponibles"],
  receptionist: ["📋 Planning du jour", "✍️ Rappel WhatsApp", "👤 Chercher un patient"],
  clinic_admin: [
    "📊 Résumé de la clinique",
    "👨‍⚕️ Performance médecins",
    "⚠️ Alertes opérationnelles",
  ],
  super_admin: ["🏥 Stats plateforme", "📈 Nouvelles cliniques", "⚡ Cliniques à surveiller"],
  patient: ["📅 Mes prochains RDV", "🕐 Prendre un rendez-vous", "ℹ️ Infos de la clinique"],
};

interface AgentWidgetProps {
  agentType: SiteTeamAgentType;
  clinicId?: string;
  userId: string;
  clinicName?: string;
  position?: "bottom-right" | "bottom-left" | "sidebar";
  defaultOpen?: boolean;
}

export function AgentWidget({
  agentType,
  clinicId,
  userId: _userId,
  clinicName,
  position = "bottom-right",
  defaultOpen = false,
}: AgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const roleConfig = getAgentRoleConfig(agentType);
  const apiBodyConfig = getAgentApiBodyConfig(agentType);

  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    sidebar: "relative",
  } as const;

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantMessageId = crypto.randomUUID();
    const nextMessages = [...messages, userMessage];

    setMessages([...nextMessages, { id: assistantMessageId, role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType,
          // Only include these when present — sending an explicit `null`
          // (e.g. a super_admin with no clinic, or no conversation yet) made
          // the request fail schema validation.
          ...(clinicId ? { clinicId } : {}),
          ...(conversationId ? { conversationId } : {}),
          ...apiBodyConfig,
          messages: nextMessages
            .filter((message) => message.content.trim().length > 0)
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
        }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("Content-Type") ?? "";
      if (!response.ok && !contentType.includes("text/event-stream")) {
        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Le service IA est temporairement indisponible.");
        }
        throw new Error("Le service IA est temporairement indisponible.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Le flux de réponse IA est indisponible.");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          const payload = JSON.parse(dataLine.slice(6)) as {
            type: "text" | "error" | "done" | "meta";
            content?: string;
            message?: string;
            conversationId?: string;
          };

          if (payload.type === "error") {
            throw new Error(payload.message ?? "Erreur IA");
          }

          if (payload.type === "meta" && payload.conversationId) {
            setConversationId(payload.conversationId);
          }

          if (payload.type === "text" && payload.content) {
            assistantText += payload.content;
            setMessages((current: ChatMessage[]) =>
              current.map((message: ChatMessage) =>
                message.id === assistantMessageId
                  ? { ...message, content: assistantText }
                  : message,
              ),
            );
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Erreur IA";
      setError(message);
      // Remove the empty assistant placeholder so the error is shown once
      // (in the styled error line below) instead of twice.
      setMessages((current: ChatMessage[]) =>
        current.filter(
          (chatMessage: ChatMessage) =>
            !(chatMessage.id === assistantMessageId && !chatMessage.content),
        ),
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  function handleSubmit() {
    void sendPrompt(input);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }

  if (!isOpen) {
    return (
      <div className={cn(position === "sidebar" ? "" : "fixed", positionClasses[position], "z-50")}>
        <Button
          size="icon"
          className="relative h-12 w-12 rounded-full shadow-lg"
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir l'assistant IA"
        >
          <Bot className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-0 p-0 text-[10px]">
            AI
          </Badge>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        position === "sidebar" ? "" : "fixed",
        positionClasses[position],
        "z-50 flex flex-col rounded-xl border bg-background shadow-2xl transition-all duration-200",
        isExpanded
          ? "h-[min(720px,calc(100vh-2rem))] w-[min(520px,calc(100vw-2rem))]"
          : "h-[520px] w-[min(380px,calc(100vw-2rem))]",
      )}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Assistant Oltigo</span>
            <Badge variant="outline" className="text-xs capitalize">
              {agentType.replace("_", " ")}
            </Badge>
          </div>
          {clinicName ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{clinicName}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {isLoading ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={stopGeneration}>
              Stop
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded((value: boolean) => !value)}
            aria-label={isExpanded ? "Réduire l'assistant" : "Agrandir l'assistant"}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
            aria-label="Fermer l'assistant IA"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Comment puis-je vous aider?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Les réponses respectent votre rôle et la clinique active.
              </p>
            </div>
            <PromptSuggestions
              suggestions={ROLE_PROMPTS[agentType] ?? []}
              onSuggestionClick={(suggestion) => void sendPrompt(suggestion)}
            />
          </div>
        ) : (
          <Chat
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            bottomRef={bottomRef}
          />
        )}
      </div>

      {roleConfig.enableDebugPanel ? (
        <AgentDebugPanel
          agentType={agentType}
          conversationId={conversationId}
          messageCount={messages.length}
          isLoading={isLoading}
          enableDataTools={roleConfig.enableDataTools}
        />
      ) : null}

      {messages.length === 0 ? (
        <div className="border-t bg-background p-3">
          <p className="text-[11px] text-muted-foreground">
            Assistant IA — vérifiez les informations critiques avant action.
          </p>
        </div>
      ) : null}
      {error ? <p className="border-t px-3 py-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
