"use client";

import { MessageCircle, X, Send, Trash2, Bot } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTenant } from "@/components/tenant-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatbot } from "./chatbot-provider";

/** Quick-action suggestions based on clinic type */
function getQuickActions(clinicType?: string): string[] {
  switch (clinicType) {
    case "dentist":
      return ["Prendre un rendez-vous", "Tarifs des soins", "Horaires d'ouverture"];
    case "pharmacy":
      return ["Produits disponibles", "Horaires d'ouverture", "Nous contacter"];
    default:
      return ["Prendre un rendez-vous", "Horaires d'ouverture", "Nous contacter"];
  }
}

export function ChatbotWidget() {
  const { messages, isOpen, isLoading, setIsOpen, sendMessage, clearMessages } =
    useChatbot();
  const tenant = useTenant();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clinicName = tenant?.clinicName || "notre cabinet";
  const clinicType = tenant?.clinicType;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const msg = input;
    setInput("");
    await sendMessage(msg);
  }

  const unreadCount = messages.filter(
    (m) => m.role === "assistant" && !isOpen
  ).length;

  const quickActions = getQuickActions(clinicType);

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(500px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b bg-primary px-4 py-3">
            <div className="flex items-center gap-2 text-primary-foreground">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">Assistant {clinicName}</p>
                <p className="text-[10px] opacity-80">
                  {isLoading ? "En train d'écrire..." : "En ligne"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={clearMessages}
                title="Effacer la conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* A214: AI medical-advice disclaimer */}
          <div className="px-3 py-1.5 text-[10px] text-center text-muted-foreground bg-muted/50 border-b">
            Aide &agrave; la d&eacute;cision — ne remplace pas l&apos;avis m&eacute;dical.
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                <Bot className="h-10 w-10 opacity-50" />
                <div>
                  <p className="text-sm font-medium">Bonjour !</p>
                  <p className="text-xs mt-1">
                    Je suis l&apos;assistant virtuel de {clinicName}.
                    <br />
                    Comment puis-je vous aider ?
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {quickActions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="rounded-full border px-3 py-1 text-[11px] hover:bg-muted transition-colors"
                      onClick={() => sendMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3" aria-live="polite" aria-relevant="additions">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1">
                        <span className="animate-pulse">.</span>
                        <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                        <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm">
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">.</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t px-3 py-2.5"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre message..."
              className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label={isOpen ? "Fermer le chat" : "Ouvrir le chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-medium">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
