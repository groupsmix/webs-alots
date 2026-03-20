"use client";

import { ChatbotProvider } from "./chatbot-provider";
import { ChatbotWidget } from "./chatbot-widget";
import { clinicConfig } from "@/config/clinic.config";

/**
 * Self-contained chatbot wrapper.
 * Renders nothing if the chatbot feature is disabled in clinic config.
 */
export function Chatbot() {
  if (!clinicConfig.features.chatbot) {
    return null;
  }

  return (
    <ChatbotProvider>
      <ChatbotWidget />
    </ChatbotProvider>
  );
}
