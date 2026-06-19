"use client";

/* eslint-disable i18next/no-literal-string -- Super-admin-only AI Builder
   surface: this whole tool is gated to internal super_admin users and is
   intentionally English-only. Adding it to the i18n keyset would inflate the
   FR/AR translation backlog for a tool no end user ever sees. */
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Send, Loader2, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { findBuilderModel, type BuilderModel } from "@/lib/builder/models";
import { BUILDER_TEMPLATES, type BuilderTemplate } from "@/lib/builder/templates";
import { cn } from "@/lib/utils";
import { SandboxPreview } from "./sandbox-preview";

interface BuilderChatProps {
  userId: string;
  /** Active providers' models, derived server-side from ai_provider_configs. */
  models: BuilderModel[];
}

// Extract plain text from AI SDK v6 UIMessage parts
function getTextContent(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function BuilderChat({ userId: _userId, models }: BuilderChatProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<BuilderTemplate>(BUILDER_TEMPLATES[0]);
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id ?? "");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/builder/sandbox" }),
  });

  // Resolve the picked model so we can send both its id and the provider that
  // serves it; the AI Worker routes on `provider`. Per-request body (below)
  // guarantees the current selection is used even though the transport is
  // created once.
  const selectedModel = findBuilderModel(models, selectedModelId) ?? models[0];

  const isLoading = status === "streaming" || status === "submitted";
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistantMsg
    ? getTextContent(lastAssistantMsg.parts as { type: string; text?: string }[])
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(
      { text: input },
      {
        body: {
          templateId: selectedTemplate.id,
          modelId: selectedModel?.id,
          provider: selectedModel?.provider,
        },
      },
    );
    setInput("");
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  function applyTemplate(template: BuilderTemplate) {
    setSelectedTemplate(template);
    setInput(template.defaultPrompt);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col w-[420px] min-w-[380px] border-r h-full">
        <div className="px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">AI Builder</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              Beta
            </Badge>
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedTemplate.id}
              onValueChange={(id) => {
                const t = BUILDER_TEMPLATES.find((t) => t.id === id);
                if (t) setSelectedTemplate(t);
              }}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILDER_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    <span className="mr-1">{t.icon}</span> {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="h-7 text-xs w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={`${m.provider}:${m.id}`} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Describe what you want to build. I&apos;ll generate complete, runnable code.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {BUILDER_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-sm font-medium">
                        <span className="mr-1">{t.icon}</span>
                        {t.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              messages.map((message: any) => {
                const text = getTextContent(message.parts as { type: string; text?: string }[]);
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <p className="text-xs text-muted-foreground mb-1">
                            Code generated → see preview panel →
                          </p>
                          <p className="text-xs leading-relaxed">
                            {text.replace(/```[\s\S]*?```/g, "[code block]")}
                          </p>
                        </div>
                      ) : (
                        <p>{text}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Generating...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="px-4 py-3 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Describe what to build... (Enter to send, Shift+Enter for new line)"
              className="min-h-[60px] max-h-[160px] text-sm resize-none"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="self-end"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedModel
              ? `Powered by ${selectedModel.name} · ${selectedModel.id}`
              : "No active AI provider — enable one in AI Config to deploy."}
          </p>
        </div>
      </div>
      <SandboxPreview
        code={lastAssistantText}
        language="typescript"
        isStreaming={isLoading}
        className="flex-1"
      />
    </div>
  );
}
