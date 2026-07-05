import type { SiteTeamAgentType } from "@/lib/ai/prompts";

export interface AgentRoleConfig {
  showThinkingPanel: boolean;
  showSourceCitations: boolean;
  enableDataTools: boolean;
  enableDebugPanel: boolean;
  maxMessages: number;
}

const DEFAULT_CONFIG: AgentRoleConfig = {
  showThinkingPanel: false,
  showSourceCitations: false,
  enableDataTools: false,
  enableDebugPanel: false,
  maxMessages: 20,
};

export function getAgentRoleConfig(agentType: SiteTeamAgentType): AgentRoleConfig {
  switch (agentType) {
    case "super_admin":
      return {
        showThinkingPanel: true,
        showSourceCitations: true,
        enableDataTools: true,
        enableDebugPanel: true,
        maxMessages: 24,
      };
    case "clinic_admin":
    case "doctor":
      return {
        ...DEFAULT_CONFIG,
        showSourceCitations: true,
        enableDataTools: true,
      };
    case "secretary":
    case "receptionist":
      return {
        ...DEFAULT_CONFIG,
        enableDataTools: true,
      };
    case "patient":
    default:
      return DEFAULT_CONFIG;
  }
}

export function getAgentApiBodyConfig(agentType: SiteTeamAgentType) {
  const config = getAgentRoleConfig(agentType);
  return {
    enableDataTools: config.enableDataTools,
    showSourceCitations: config.showSourceCitations,
    maxMessages: config.maxMessages,
  };
}
