"use client";

import { useTenant } from "@/components/tenant-provider";
import { ChatbotProvider } from "./chatbot-provider";
import { ChatbotWidget } from "./chatbot-widget";

/**
 * Self-contained chatbot wrapper.
 * Tenant-aware: reads clinic info from tenant context (subdomain resolution).
 * Renders nothing if no tenant context is available (root domain / super-admin).
 */
export function Chatbot() {
  const tenant = useTenant();

  // Only show chatbot on tenant subdomains (not root domain or super-admin)
  if (!tenant?.clinicId) {
    return null;
  }

  return (
    <ChatbotProvider clinicId={tenant.clinicId}>
      <ChatbotWidget />
    </ChatbotProvider>
  );
}
