/**
 * Tests for Phase C1: AI Team Task state machine.
 *
 * Covers:
 * - All legal transitions
 * - All illegal transitions (terminal states, forbidden hops)
 * - Optimistic concurrency conflict detection
 * - Max review cycle escalation
 * - History event appending
 * - Task creation
 */
import { describe, it, expect, vi } from "vitest";
import {
  validateTransition,
  buildHistoryEvent,
  transitionTask,
  createTeamTask,
  TASK_STATUSES,
  type TaskStatus,
  type TaskHistoryEvent,
} from "@/lib/ai/team-data";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── validateTransition ──

describe("validateTransition", () => {
  const legalTransitions: [TaskStatus, TaskStatus][] = [
    ["backlog", "in_progress"],
    ["backlog", "cancelled"],
    ["in_progress", "review"],
    ["in_progress", "cancelled"],
    ["review", "done"],
    ["review", "changes_requested"],
    ["review", "cancelled"],
    ["changes_requested", "in_progress"],
    ["changes_requested", "cancelled"],
  ];

  it.each(legalTransitions)("allows %s → %s", (from, to) => {
    const result = validateTransition(from, to);
    expect(result).toEqual({ valid: true });
  });

  const illegalTransitions: [TaskStatus, TaskStatus][] = [
    // Terminal states
    ["done", "backlog"],
    ["done", "in_progress"],
    ["done", "review"],
    ["done", "cancelled"],
    ["cancelled", "backlog"],
    ["cancelled", "in_progress"],
    // Skipping steps
    ["backlog", "review"],
    ["backlog", "done"],
    ["backlog", "changes_requested"],
    ["in_progress", "done"],
    ["in_progress", "backlog"],
    ["in_progress", "changes_requested"],
    ["review", "backlog"],
    ["review", "in_progress"],
    ["changes_requested", "review"],
    ["changes_requested", "done"],
    ["changes_requested", "backlog"],
  ];

  it.each(illegalTransitions)("rejects %s → %s", (from, to) => {
    const result = validateTransition(from, to);
    expect(result).toEqual(
      expect.objectContaining({ valid: false, message: expect.stringContaining("Illegal") }),
    );
  });

  it("covers all statuses in at least one test", () => {
    const tested = new Set([
      ...legalTransitions.flatMap(([from, to]) => [from, to]),
      ...illegalTransitions.flatMap(([from, to]) => [from, to]),
    ]);
    for (const status of TASK_STATUSES) {
      expect(tested.has(status)).toBe(true);
    }
  });
});

// ── buildHistoryEvent ──

describe("buildHistoryEvent", () => {
  it("creates an event with current timestamp", () => {
    const before = new Date().toISOString();
    const event = buildHistoryEvent("created", "user-123", { agentType: "marketing" });
    const after = new Date().toISOString();

    expect(event.type).toBe("created");
    expect(event.actor).toBe("user-123");
    expect(event.payload).toEqual({ agentType: "marketing" });
    expect(event.at >= before && event.at <= after).toBe(true);
  });
});

// ── transitionTask ──

describe("transitionTask", () => {
  function mockSupabase(opts: {
    fetchData?: Record<string, unknown> | null;
    fetchError?: unknown;
    updateError?: unknown;
  }) {
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: opts.fetchData ?? null,
                error: opts.fetchError ?? null,
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                error: opts.updateError ?? null,
              })),
            })),
          })),
        })),
      })),
    };
  }

  const taskId = "00000000-0000-0000-0000-000000000001";
  const clinicId = "00000000-0000-0000-0000-000000000099";
  const actor = "user-actor";

  it("rejects illegal transitions before DB call", async () => {
    const supa = mockSupabase({});
    const result = await transitionTask(supa, taskId, clinicId, "done", "in_progress", actor);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ILLEGAL_TRANSITION");
    }
    // Should not have hit the DB
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("returns TASK_NOT_FOUND when task does not exist", async () => {
    const supa = mockSupabase({ fetchData: null, fetchError: { message: "not found" } });
    const result = await transitionTask(supa, taskId, clinicId, "backlog", "in_progress", actor);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TASK_NOT_FOUND");
    }
  });

  it("returns OPTIMISTIC_CONFLICT when status doesn't match expected", async () => {
    const supa = mockSupabase({
      fetchData: {
        id: taskId,
        status: "in_progress",
        review_cycles: 0,
        history_events: [],
      },
    });
    const result = await transitionTask(supa, taskId, clinicId, "backlog", "in_progress", actor);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("OPTIMISTIC_CONFLICT");
    }
  });

  it("successfully transitions backlog → in_progress", async () => {
    const supa = mockSupabase({
      fetchData: {
        id: taskId,
        status: "backlog",
        review_cycles: 0,
        history_events: [],
      },
    });
    const result = await transitionTask(supa, taskId, clinicId, "backlog", "in_progress", actor);
    expect(result).toEqual({ ok: true, newStatus: "in_progress", escalated: false });
  });

  it("escalates when review_cycles > 2 on transition to review", async () => {
    const supa = mockSupabase({
      fetchData: {
        id: taskId,
        status: "in_progress",
        review_cycles: 2,
        history_events: [
          { type: "created", actor: "system", at: "2026-01-01T00:00:00Z", payload: {} },
        ] as TaskHistoryEvent[],
      },
    });
    const result = await transitionTask(supa, taskId, clinicId, "in_progress", "review", actor);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.escalated).toBe(true);
      expect(result.newStatus).toBe("review");
    }
  });

  it("passes review comments through to update", async () => {
    const supa = mockSupabase({
      fetchData: {
        id: taskId,
        status: "review",
        review_cycles: 1,
        history_events: [],
      },
    });
    const result = await transitionTask(
      supa,
      taskId,
      clinicId,
      "review",
      "changes_requested",
      actor,
      {
        reviewComments: "Need to fix the wording",
      },
    );
    expect(result).toEqual({ ok: true, newStatus: "changes_requested", escalated: false });
  });
});

// ── createTeamTask ──

describe("createTeamTask", () => {
  it("inserts a task with created history event", async () => {
    const insertedData = { id: "new-task-id" };
    const mockSupa = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: insertedData, error: null })),
          })),
        })),
      })),
    };

    const result = await createTeamTask(mockSupa, "clinic-1", {
      title: "Draft campaign",
      description: "Draft a Ramadan campaign",
      agentType: "marketing",
      createdBy: "user-123",
    });

    expect(result).toEqual({ id: "new-task-id" });
    expect(mockSupa.from).toHaveBeenCalledWith("ai_team_tasks");
  });

  it("returns null on insert failure", async () => {
    const mockSupa = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null, error: { message: "insert failed" } })),
          })),
        })),
      })),
    };

    const result = await createTeamTask(mockSupa, "clinic-1", {
      title: "Test",
      agentType: "support",
    });
    expect(result).toBeNull();
  });
});
