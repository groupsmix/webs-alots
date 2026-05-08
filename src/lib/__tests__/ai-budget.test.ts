/**
 * Unit tests for AI Token Budget Enforcement (A1-01)
 *
 * Tests the core budget checking and token tracking functionality
 * to prevent unbounded AI token consumption attacks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_TOKEN_LIMITS,
  estimateTokens,
  checkAiTokenBudget,
  incrementAiTokenUsage,
  getAiTokenBudgetStatus,
} from "../ai-budget";
import type { UserRole } from "../types/database";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
} as unknown as SupabaseClient;

// Mock logger to avoid console output in tests
vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("AI Budget Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AI_TOKEN_LIMITS", () => {
    it("should define limits for all user roles", () => {
      expect(AI_TOKEN_LIMITS.patient).toBe(10_000);
      expect(AI_TOKEN_LIMITS.receptionist).toBe(20_000);
      expect(AI_TOKEN_LIMITS.doctor).toBe(50_000);
      expect(AI_TOKEN_LIMITS.clinic_admin).toBe(100_000);
      expect(AI_TOKEN_LIMITS.super_admin).toBe(1_000_000);
    });

    it("should have increasing limits by role privilege", () => {
      expect(AI_TOKEN_LIMITS.patient).toBeLessThan(AI_TOKEN_LIMITS.receptionist);
      expect(AI_TOKEN_LIMITS.receptionist).toBeLessThan(AI_TOKEN_LIMITS.doctor);
      expect(AI_TOKEN_LIMITS.doctor).toBeLessThan(AI_TOKEN_LIMITS.clinic_admin);
      expect(AI_TOKEN_LIMITS.clinic_admin).toBeLessThan(AI_TOKEN_LIMITS.super_admin);
    });
  });

  describe("estimateTokens", () => {
    it("should estimate 1 token per 4 characters", () => {
      expect(estimateTokens("test")).toBe(1); // 4 chars = 1 token
      expect(estimateTokens("hello")).toBe(2); // 5 chars = 2 tokens (rounded up)
      expect(estimateTokens("hello world")).toBe(3); // 11 chars = 3 tokens
    });

    it("should handle empty strings", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("should round up fractional tokens", () => {
      expect(estimateTokens("a")).toBe(1); // 1 char = 0.25 tokens → 1
      expect(estimateTokens("ab")).toBe(1); // 2 chars = 0.5 tokens → 1
      expect(estimateTokens("abc")).toBe(1); // 3 chars = 0.75 tokens → 1
    });
  });

  describe("checkAiTokenBudget", () => {
    const clinicId = "clinic-123";
    const mockClinicData = {
      ai_monthly_tokens: 5000,
      ai_tokens_reset_at: "2026-05-01T00:00:00Z",
    };

    beforeEach(() => {
      // Mock successful clinic query by default
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockClinicData,
            error: null,
          }),
        }),
      });
      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
    });

    it("should allow request when usage is under limit", async () => {
      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "doctor", // 50k limit
        1000, // requesting 1k tokens
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(44000); // 50k - 5k - 1k = 44k
    });

    it("should deny request when usage would exceed limit", async () => {
      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "patient", // 10k limit
        6000, // requesting 6k tokens (5k current + 6k = 11k > 10k)
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(5000); // 10k - 5k = 5k remaining
    });

    it("should use patient limit for unknown roles", async () => {
      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "unknown_role" as UserRole,
        1000,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4000); // 10k (patient limit) - 5k - 1k = 4k
    });

    it("should reset counter when month boundary is crossed", async () => {
      // Mock clinic with old reset date (previous month)
      const oldResetData = {
        ai_monthly_tokens: 8000,
        ai_tokens_reset_at: "2026-04-01T00:00:00Z", // Previous month
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: oldResetData,
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "doctor",
        1000,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49000); // Reset to 0, so 50k - 0 - 1k = 49k

      // Verify reset was called
      expect(mockUpdate).toHaveBeenCalledWith({
        ai_monthly_tokens: 0,
        ai_tokens_reset_at: expect.stringMatching(/2026-05-01T00:00:00/),
      });
    });

    it("should handle database errors gracefully (fail-closed)", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
      });

      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "doctor",
        1000,
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should handle missing clinic gracefully (fail-closed)", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
      });

      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "doctor",
        1000,
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should continue with old usage if reset fails", async () => {
      // Mock clinic with old reset date but reset update fails
      const oldResetData = {
        ai_monthly_tokens: 3000,
        ai_tokens_reset_at: "2026-04-01T00:00:00Z",
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: oldResetData,
            error: null,
          }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      const result = await checkAiTokenBudget(
        mockSupabase,
        clinicId,
        "doctor",
        1000,
      );

      // Should use old usage value (3000) as fallback
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(46000); // 50k - 3k - 1k = 46k
    });
  });

  describe("incrementAiTokenUsage", () => {
    beforeEach(() => {
      (mockSupabase.rpc as any).mockResolvedValue({ error: null });
    });

    it("should call increment RPC with correct parameters", async () => {
      await incrementAiTokenUsage(mockSupabase, "clinic-123", 500);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_ai_tokens", {
        p_clinic_id: "clinic-123",
        p_tokens: 500,
      });
    });

    it("should handle zero tokens gracefully", async () => {
      await incrementAiTokenUsage(mockSupabase, "clinic-123", 0);

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("should handle negative tokens gracefully", async () => {
      await incrementAiTokenUsage(mockSupabase, "clinic-123", -100);

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("should not throw on RPC errors", async () => {
      (mockSupabase.rpc as any).mockResolvedValue({
        error: { message: "RPC failed" },
      });

      // Should not throw
      await expect(
        incrementAiTokenUsage(mockSupabase, "clinic-123", 500)
      ).resolves.toBeUndefined();
    });
  });

  describe("getAiTokenBudgetStatus", () => {
    it("should return current budget status", async () => {
      const mockClinicData = {
        ai_monthly_tokens: 7500,
        ai_tokens_reset_at: "2026-05-01T00:00:00Z",
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockClinicData,
            error: null,
          }),
        }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
      });

      const result = await getAiTokenBudgetStatus(
        mockSupabase,
        "clinic-123",
        "doctor"
      );

      expect(result).toEqual({
        usage: 7500,
        limit: 50000,
        remaining: 42500,
        resetAt: "2026-05-01T00:00:00Z",
      });
    });

    it("should handle missing clinic data", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
      });

      const result = await getAiTokenBudgetStatus(
        mockSupabase,
        "clinic-123",
        "doctor"
      );

      expect(result).toEqual({
        usage: 0,
        limit: 50000,
        remaining: 50000,
        resetAt: null,
      });
    });

    it("should handle null usage values", async () => {
      const mockClinicData = {
        ai_monthly_tokens: null,
        ai_tokens_reset_at: null,
      };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockClinicData,
            error: null,
          }),
        }),
      });

      (mockSupabase.from as any).mockReturnValue({
        select: mockSelect,
      });

      const result = await getAiTokenBudgetStatus(
        mockSupabase,
        "clinic-123",
        "patient"
      );

      expect(result).toEqual({
        usage: 0,
        limit: 10000,
        remaining: 10000,
        resetAt: null,
      });
    });
  });

  // Property-based test: any request exceeding role limit should be rejected
  describe("Property-based tests", () => {
    it("should reject any request that exceeds role limit", async () => {
      const roles: UserRole[] = ["patient", "receptionist", "doctor", "clinic_admin", "super_admin"];
      
      for (const role of roles) {
        const limit = AI_TOKEN_LIMITS[role];
        
        // Mock clinic with no current usage
        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ai_monthly_tokens: 0, ai_tokens_reset_at: "2026-05-01T00:00:00Z" },
              error: null,
            }),
          }),
        });

        (mockSupabase.from as any).mockReturnValue({
          select: mockSelect,
        });

        // Request exactly limit + 1 tokens
        const result = await checkAiTokenBudget(
          mockSupabase,
          "clinic-123",
          role,
          limit + 1
        );

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(limit);
      }
    });

    it("should allow any request within role limit", async () => {
      const roles: UserRole[] = ["patient", "receptionist", "doctor", "clinic_admin", "super_admin"];
      
      for (const role of roles) {
        const limit = AI_TOKEN_LIMITS[role];
        
        // Mock clinic with no current usage
        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ai_monthly_tokens: 0, ai_tokens_reset_at: "2026-05-01T00:00:00Z" },
              error: null,
            }),
          }),
        });

        (mockSupabase.from as any).mockReturnValue({
          select: mockSelect,
        });

        // Request exactly limit tokens (should be allowed)
        const result = await checkAiTokenBudget(
          mockSupabase,
          "clinic-123",
          role,
          limit
        );

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
      }
    });
  });
});