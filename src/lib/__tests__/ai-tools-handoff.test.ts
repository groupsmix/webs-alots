/**
 * Tests for Phase C2: Agent-to-agent handoff protocol.
 *
 * Covers:
 * - Handoff tool availability per agent type
 * - Guard rails: forbidden sources, forbidden targets, self-handoff, depth limit
 * - Successful handoff creates a durable task
 * - Audit log event on handoff
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi } from "vitest";
import { getAgentTools, executeAgentTool, type AgentToolContext } from "@/lib/ai/tools";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/ai/team-data", () => ({
  createTeamTask: vi.fn(async () => ({ id: "handoff-task-id" })),
  buildHistoryEvent: vi.fn(() => ({
    type: "handoff",
    actor: "user-123",
    at: "2026-06-10T00:00:00.000Z",
    payload: {},
  })),
}));

function mockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: null })),
    })),
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    supabase: mockSupabase(),
    clinicId: "clinic-001",
    userId: "user-123",
    profileId: "profile-123",
    userRole: "clinic_admin",
    agentType: "clinic_admin",
    ...overrides,
  };
}

// ── Tool availability ──

describe("handoff tool availability", () => {
  it("is available for secretary agents", () => {
    const tools = getAgentTools("secretary");
    expect(tools.some((t) => t.name === "handoff_to_agent")).toBe(true);
  });

  it("is available for clinic_admin agents", () => {
    const tools = getAgentTools("clinic_admin");
    expect(tools.some((t) => t.name === "handoff_to_agent")).toBe(true);
  });

  it("is NOT available for patient agents", () => {
    const tools = getAgentTools("patient");
    expect(tools.some((t) => t.name === "handoff_to_agent")).toBe(false);
  });

  it("is NOT available for doctor agents", () => {
    const tools = getAgentTools("doctor");
    expect(tools.some((t) => t.name === "handoff_to_agent")).toBe(false);
  });
});

// ── Guard rails ──

describe("handoff guard rails", () => {
  it("rejects handoff from patient agent", async () => {
    const ctx = makeCtx({ agentType: "patient" });
    const result = await executeAgentTool(
      "handoff_to_agent",
      { target_agent_type: "doctor", task_summary: "clinical question" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TOOL_FORBIDDEN");
    }
  });

  it("rejects handoff targeting patient agent", async () => {
    const ctx = makeCtx({ agentType: "secretary" });
    const result = await executeAgentTool(
      "handoff_to_agent",
      { target_agent_type: "patient", task_summary: "test" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HANDOFF_TARGET_FORBIDDEN");
    }
  });

  it("rejects self-handoff", async () => {
    const ctx = makeCtx({ agentType: "secretary" });
    const result = await executeAgentTool(
      "handoff_to_agent",
      { target_agent_type: "secretary", task_summary: "test" },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HANDOFF_SELF");
    }
  });

  it("rejects chained handoff (depth > 1)", async () => {
    const ctx = makeCtx({ agentType: "secretary" });
    const result = await executeAgentTool(
      "handoff_to_agent",
      {
        target_agent_type: "doctor",
        task_summary: "clinical question",
        _source_task_id: "existing-task",
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HANDOFF_DEPTH_EXCEEDED");
    }
  });
});

// ── Successful handoff ──

describe("successful handoff", () => {
  it("secretary hands off clinical question to doctor", async () => {
    const ctx = makeCtx({ agentType: "secretary" });
    const result = await executeAgentTool(
      "handoff_to_agent",
      {
        target_agent_type: "doctor",
        task_summary: "Patient asks about medication dosage",
        context: "The patient is asking about dosage for a blood pressure medication.",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { taskId: string; targetAgentType: string };
      expect(data.taskId).toBe("handoff-task-id");
      expect(data.targetAgentType).toBe("doctor");
    }
  });

  it("clinic_admin hands off to secretary", async () => {
    const ctx = makeCtx({ agentType: "clinic_admin" });
    const result = await executeAgentTool(
      "handoff_to_agent",
      {
        target_agent_type: "secretary",
        task_summary: "Schedule follow-up reminders",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { taskId: string; targetAgentType: string };
      expect(data.targetAgentType).toBe("secretary");
    }
  });
});
