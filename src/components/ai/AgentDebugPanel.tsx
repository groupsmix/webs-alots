"use client";

/* eslint-disable i18next/no-literal-string -- Super-admin-only AI debugging surface. */
import { Activity, DatabaseZap, ShieldCheck } from "lucide-react";
import { ToolCall } from "@/components/ui/tool-call";
import type { SiteTeamAgentType } from "@/lib/ai/prompts";

interface AgentDebugPanelProps {
  agentType: SiteTeamAgentType;
  conversationId?: string | null;
  messageCount: number;
  isLoading: boolean;
  enableDataTools: boolean;
}

export function AgentDebugPanel({
  agentType,
  conversationId,
  messageCount,
  isLoading,
  enableDataTools,
}: AgentDebugPanelProps) {
  if (agentType !== "super_admin") return null;

  return (
    <div className="border-t bg-muted/20 p-3 text-xs">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <Activity className="h-3.5 w-3.5 text-primary" />
        Debug IA
      </div>
      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Tenant + RBAC enforced by API route
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <DatabaseZap className="h-3.5 w-3.5" />
          Conversation: {conversationId ?? "new"} · Messages: {messageCount}
        </div>
        <ToolCall
          name="data_tools"
          state={isLoading ? "running" : enableDataTools ? "success" : "error"}
          description={enableDataTools ? "Read-only tools enabled" : "Tools disabled for this role"}
        />
      </div>
    </div>
  );
}
