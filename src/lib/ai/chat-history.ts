import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { fromUntyped } from "@/lib/ai/untyped-tables";
import type { SiteTeamAgentType } from "@/lib/ai/prompts";

type UntypedSupabase = SupabaseClient;

type ConversationRow = { id: string };

export interface SaveAgentConversationTurnParams {
  supabase: UntypedSupabase;
  conversationId?: string;
  clinicId: string;
  userId: string;
  agentType: SiteTeamAgentType;
  userMessage: string;
  assistantMessage: string;
  toolName: string | null;
  toolResult: unknown;
  tokensIn: number;
  tokensOut: number;
}

export interface IncrementAgentTokenUsageParams {
  supabase: UntypedSupabase;
  clinicId: string;
  agentType: SiteTeamAgentType;
  tokensIn: number;
  tokensOut: number;
}

function safeConversationTitle(message: string): string {
  return message
    .replace(/(?:\+212|0)([ .\-]?\d){9}/g, "[téléphone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function saveAgentConversationTurn({
  supabase,
  conversationId,
  clinicId,
  userId,
  agentType,
  userMessage,
  assistantMessage,
  toolName,
  toolResult,
  tokensIn,
  tokensOut,
}: SaveAgentConversationTurnParams): Promise<string | null> {
  let resolvedConversationId = conversationId;

  if (resolvedConversationId) {
    const { data } = await fromUntyped(supabase, "agent_conversations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("user_id", userId)
      .eq("id", resolvedConversationId)
      .maybeSingle();
    resolvedConversationId = (data as ConversationRow | null)?.id;
  }

  if (!resolvedConversationId) {
    const { data, error } = await fromUntyped(supabase, "agent_conversations")
      .insert({
        clinic_id: clinicId,
        user_id: userId,
        agent_type: agentType,
        title: safeConversationTitle(userMessage) || "Conversation assistant",
      })
      .select("id")
      .single();

    if (error) {
      logger.warn("Failed to create agent conversation", {
        context: "site-team-agent/history",
        clinicId,
        agentType,
        error: error.message,
      });
      return null;
    }
    resolvedConversationId = (data as ConversationRow).id;
  }

  const rows = [
    {
      conversation_id: resolvedConversationId,
      clinic_id: clinicId,
      role: "user",
      content: userMessage,
      tool_name: null,
      tool_result: null,
      tokens_used: tokensIn,
    },
    {
      conversation_id: resolvedConversationId,
      clinic_id: clinicId,
      role: "assistant",
      content: assistantMessage,
      tool_name: toolName,
      tool_result: toolResult,
      tokens_used: tokensOut,
    },
  ];

  const { error: messageError } = await fromUntyped(supabase, "agent_messages").insert(rows);
  if (messageError) {
    logger.warn("Failed to save agent messages", {
      context: "site-team-agent/history",
      clinicId,
      agentType,
      error: messageError.message,
    });
  }

  await fromUntyped(supabase, "agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId)
    .eq("id", resolvedConversationId);

  return resolvedConversationId;
}

export async function incrementAgentTokenUsage({
  supabase,
  clinicId,
  agentType,
  tokensIn,
  tokensOut,
}: IncrementAgentTokenUsageParams): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await fromUntyped(supabase, "agent_token_usage")
    .select("tokens_in, tokens_out, request_count")
    .eq("clinic_id", clinicId)
    .eq("agent_type", agentType)
    .eq("date", today)
    .maybeSingle();

  const current = existing as
    | { tokens_in: number | null; tokens_out: number | null; request_count: number | null }
    | null;

  if (current) {
    await fromUntyped(supabase, "agent_token_usage")
      .update({
        tokens_in: Number(current.tokens_in ?? 0) + tokensIn,
        tokens_out: Number(current.tokens_out ?? 0) + tokensOut,
        request_count: Number(current.request_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", clinicId)
      .eq("agent_type", agentType)
      .eq("date", today);
    return;
  }

  await fromUntyped(supabase, "agent_token_usage").insert({
    clinic_id: clinicId,
    agent_type: agentType,
    date: today,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    request_count: 1,
  });
}
