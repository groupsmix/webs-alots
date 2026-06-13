"use client";

// @ts-nocheck  — CopilotKit feature disabled (hotfix 2026-06-06), dead code kept for re-enablement path. See copilot-shell.tsx ADR.

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import "@/styles/copilotkit-overrides.css";
import { CopilotActions } from "./copilot-actions";
import { CopilotDataProvider } from "./copilot-data-provider";

const COPILOT_INSTRUCTIONS = `You are a super admin assistant for a Moroccan health SaaS platform called Oltigo.
The platform serves doctors, dentists, and pharmacies across Morocco.

YOUR CAPABILITIES:
- Answer questions about the data you've been given (clinics, KYC queue, revenue)
- Help draft WhatsApp messages in French or Darija
- Explain system status and issues
- Guide the admin through complex workflows (KYC approval, refund dual-control)
- Generate SQL queries for the admin to run manually (never execute them yourself)

RULES:
- Always use MAD (Moroccan Dirham) for monetary values
- Prefer French for responses unless the admin writes in Arabic/Darija
- Never reveal internal system details or API keys
- Never promise actions you cannot take (you cannot directly modify the database)
- When suggesting actions, give the exact button/menu path in the dashboard

CONTEXT:
- Platform: Moroccan multi-tenant health SaaS
- Payment: CMI gateway
- Notifications: WhatsApp Business API with Darija templates
- Compliance: Moroccan Law 09-08 (data privacy)`;

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotSidebar
        instructions={COPILOT_INSTRUCTIONS}
        defaultOpen={false}
        clickOutsideToClose={true}
        labels={{
          title: "Admin Assistant",
          initial:
            "Hi! I can help you manage clinics, users, KYC approvals, and payments. What do you need?",
          placeholder: "Ask about clinics, revenue, KYC...",
        }}
      >
        <CopilotDataProvider>
          <CopilotActions />
          {children}
        </CopilotDataProvider>
      </CopilotSidebar>
    </CopilotKit>
  );
}
