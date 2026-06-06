"use client";

/* eslint-disable i18next/no-literal-string -- Shared beta AI chat UI copy. */
import type { RefObject } from "react";
import { Loader2 } from "lucide-react";
import { ChatInput } from "@/components/ui/chat-input";
import { ChatMessage } from "@/components/ui/chat-message";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ChatUiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatProps {
  messages: ChatUiMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  bottomRef?: RefObject<HTMLDivElement | null>;
}

export function Chat({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading = false,
  bottomRef,
}: ChatProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={
                message.content || (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Réflexion…
                  </span>
                )
              }
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        isLoading={isLoading}
        placeholder="Écrivez votre question…"
      />
    </div>
  );
}
