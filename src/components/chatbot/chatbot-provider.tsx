"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatbotContextValue {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  setIsOpen: (open: boolean) => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const ChatbotContext = createContext<ChatbotContextValue | null>(null);

export function useChatbot() {
  const ctx = useContext(ChatbotContext);
  if (!ctx) {
    throw new Error("useChatbot must be used within a ChatbotProvider");
  }
  return ctx;
}

export function ChatbotProvider({
  clinicId,
  children,
}: {
  clinicId?: string;
  children: ReactNode;
}) {
  const [locale] = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  // Keep a ref to the latest messages so sendMessage doesn't recreate on
  // every message change (avoids stale closure & unnecessary re-renders).
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Cleanup: abort any in-flight stream when the component unmounts
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  interface ChatJsonResponse {
    ok: boolean;
    data?: {
      message?: { role: string; content: string };
      disclaimer?: string;
      language?: string;
    };
  }

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      const fallbackContent = t(locale, "chatbot.error");

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Abort any previous in-flight request before starting a new one.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const appendAssistantMessage = (messageContent: string) => {
        if (!isMountedRef.current || controller.signal.aborted) return;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content: messageContent,
            timestamp: new Date(),
          },
        ]);
      };

      try {
        const apiMessages = [
          ...messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: trimmed },
        ];

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, clinicId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          logger.warn("Chat API returned a non-success status", {
            context: "chatbot-provider",
            status: response.status,
          });
          appendAssistantMessage(fallbackContent);
          return;
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream")) {
          const reader = response.body?.getReader();
          if (!reader) {
            logger.warn("Chat API returned no response body", { context: "chatbot-provider" });
            appendAssistantMessage(fallbackContent);
            return;
          }

          const decoder = new TextDecoder();
          const assistantMsgId = `msg-${Date.now()}-assistant`;

          if (isMountedRef.current && !controller.signal.aborted) {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                role: "assistant",
                content: "",
                timestamp: new Date(),
              },
            ]);
          }

          let accumulated = "";
          let lineBuffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              const payloadText = line.slice(6).trim();
              if (!payloadText || payloadText === "[DONE]") continue;
              if (!payloadText.startsWith("{")) continue;

              try {
                const json = JSON.parse(payloadText) as { content?: string };
                if (json.content) {
                  accumulated += json.content;
                  const currentContent = accumulated;
                  if (isMountedRef.current && !controller.signal.aborted) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId ? { ...m, content: currentContent } : m,
                      ),
                    );
                  }
                }
              } catch {
                continue;
              }
            }
          }

          if (!accumulated.trim() && isMountedRef.current && !controller.signal.aborted) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fallbackContent } : m)),
            );
          }
        } else {
          let data: ChatJsonResponse;

          try {
            data = (await response.json()) as ChatJsonResponse;
          } catch (parseError) {
            logger.warn("Failed to parse chatbot JSON response", {
              context: "chatbot-provider",
              error: parseError,
            });
            appendAssistantMessage(fallbackContent);
            return;
          }

          appendAssistantMessage(data.data?.message?.content || fallbackContent);
        }
      } catch (error) {
        const isAbort =
          controller.signal.aborted || (error instanceof Error && error.name === "AbortError");

        if (isAbort) {
          return;
        }

        logger.warn("Failed to process chatbot message", { context: "chatbot-provider", error });
        appendAssistantMessage(fallbackContent);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }
    },
    [clinicId, locale],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ChatbotContext.Provider
      value={{ messages, isOpen, isLoading, setIsOpen, sendMessage, clearMessages }}
    >
      {children}
    </ChatbotContext.Provider>
  );
}
