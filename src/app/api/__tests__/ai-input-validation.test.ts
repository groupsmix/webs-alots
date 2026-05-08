/**
 * Integration tests for AI Input Validation & Token Budget Enforcement (A1-01)
 *
 * Tests the complete request → validation → budget check → response chain
 * for all AI endpoints to prevent unbounded token consumption attacks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenant: vi.fn(),
  requireTenantWithConfig: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock OpenAI to avoid actual API calls
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "Mocked AI response" } }],
          usage: { total_tokens: 100 },
        }),
      },
    },
  })),
}));

// Helper to create mock request
function createMockRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-clinic-id": "clinic-123",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// Helper to create mock Supabase client
function createMockSupabaseClient(overrides: Partial<{
  clinicData: any;
  profileData: any;
  rpcError: any;
}> = {}): SupabaseClient {
  const mockClient = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: overrides.clinicData || {
              ai_monthly_tokens: 5000,
              ai_tokens_reset_at: "2026-05-01T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ error: overrides.rpcError || null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;

  return mockClient;
}

// Mock profile data
const mockProfile = {
  id: "user-123",
  role: "doctor" as const,
  clinic_id: "clinic-123",
};

describe("AI Input Validation - Chat Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    createClient.mockReturnValue(createMockSupabaseClient());
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: mockProfile,
    });
  });

  it("should reject chat message content exceeding 4000 characters", async () => {
    const { POST } = await import("@/app/api/chat/route");
    
    const request = createMockRequest({
      messages: [
        {
          role: "user",
          content: "x".repeat(4001), // Exceeds CHAT_MESSAGE_CONTENT_MAX
        },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should reject chat messages array exceeding 20 items", async () => {
    const { POST } = await import("@/app/api/chat/route");
    
    const messages = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const request = createMockRequest({ messages });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should accept valid chat request within limits", async () => {
    const { POST } = await import("@/app/api/chat/route");
    
    const request = createMockRequest({
      messages: [
        {
          role: "user",
          content: "Hello, I need help with my symptoms.", // Well within 4000 chars
        },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("should return 429 when AI budget is exceeded", async () => {
    const { POST } = await import("@/app/api/chat/route");
    
    // Mock clinic with high usage (doctor limit is 50k)
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    createClient.mockReturnValue(createMockSupabaseClient({
      clinicData: {
        ai_monthly_tokens: 49900, // Very close to 50k limit
        ai_tokens_reset_at: "2026-05-01T00:00:00Z",
      },
    }));

    const request = createMockRequest({
      messages: [
        {
          role: "user",
          content: "This is a very long message that will exceed the remaining budget when estimated. ".repeat(50),
        },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("budget");
    expect(data.remaining).toBeDefined();
  });
});

describe("AI Input Validation - Prescription Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    createClient.mockReturnValue(createMockSupabaseClient());
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: mockProfile,
    });
  });

  it("should reject diagnosis exceeding 2000 characters", async () => {
    const { POST } = await import("@/app/api/v1/ai/prescription/route");
    
    const request = createMockRequest({
      patientId: "patient-123",
      diagnosis: "x".repeat(2001), // Exceeds limit
      symptoms: "Fever, headache",
      patientAge: 30,
      patientGender: "M",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should reject symptoms exceeding 2000 characters", async () => {
    const { POST } = await import("@/app/api/v1/ai/prescription/route");
    
    const request = createMockRequest({
      patientId: "patient-123",
      diagnosis: "Common cold",
      symptoms: "x".repeat(2001), // Exceeds limit
      patientAge: 30,
      patientGender: "M",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should accept valid prescription request", async () => {
    const { POST } = await import("@/app/api/v1/ai/prescription/route");
    
    const request = createMockRequest({
      patientId: "patient-123",
      diagnosis: "Common cold",
      symptoms: "Fever, headache, runny nose",
      patientAge: 30,
      patientGender: "M",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe("AI Input Validation - Manager Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    createClient.mockReturnValue(createMockSupabaseClient());
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: mockProfile,
    });
  });

  it("should reject question exceeding 2000 characters", async () => {
    const { POST } = await import("@/app/api/ai/manager/route");
    
    const request = createMockRequest({
      question: "x".repeat(2001), // Exceeds limit
      history: "Previous context",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should reject history exceeding 2000 characters", async () => {
    const { POST } = await import("@/app/api/ai/manager/route");
    
    const request = createMockRequest({
      question: "How can I improve patient satisfaction?",
      history: "x".repeat(2001), // Exceeds limit
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should accept valid manager request", async () => {
    const { POST } = await import("@/app/api/ai/manager/route");
    
    const request = createMockRequest({
      question: "How can I improve patient satisfaction?",
      history: "We have been getting some complaints about wait times.",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe("AI Input Validation - Auto-Suggest Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    createClient.mockReturnValue(createMockSupabaseClient());
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: mockProfile,
    });
  });

  it("should reject diagnosis exceeding 2000 characters", async () => {
    const { POST } = await import("@/app/api/ai/auto-suggest/route");
    
    const request = createMockRequest({
      diagnosis: "x".repeat(2001), // Exceeds limit
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should accept valid auto-suggest request", async () => {
    const { POST } = await import("@/app/api/ai/auto-suggest/route");
    
    const request = createMockRequest({
      diagnosis: "Hypertension",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe("AI Input Validation - Drug Check Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    createClient.mockReturnValue(createMockSupabaseClient());
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: mockProfile,
    });
  });

  it("should reject medication names exceeding 200 characters", async () => {
    const { POST } = await import("@/app/api/v1/ai/drug-check/route");
    
    const request = createMockRequest({
      medications: [
        "x".repeat(201), // Exceeds limit
        "Aspirin",
      ],
      patientAge: 30,
      patientWeight: 70,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("validation");
  });

  it("should accept valid drug check request", async () => {
    const { POST } = await import("@/app/api/v1/ai/drug-check/route");
    
    const request = createMockRequest({
      medications: ["Aspirin", "Ibuprofen"],
      patientAge: 30,
      patientWeight: 70,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe("AI Budget Enforcement Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should enforce patient role limits (10k tokens)", async () => {
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    // Mock patient profile
    createClient.mockReturnValue(createMockSupabaseClient({
      clinicData: {
        ai_monthly_tokens: 9500, // Close to 10k limit
        ai_tokens_reset_at: "2026-05-01T00:00:00Z",
      },
    }));
    
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: { ...mockProfile, role: "patient" },
    });

    const { POST } = await import("@/app/api/chat/route");
    
    const request = createMockRequest({
      messages: [
        {
          role: "user",
          content: "This is a long message that will exceed the patient budget limit. ".repeat(100),
        },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("budget");
    expect(data.remaining).toBe(500); // 10k - 9.5k = 500
  });

  it("should allow super_admin with high limits (1M tokens)", async () => {
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    createClient.mockReturnValue(createMockSupabaseClient({
      clinicData: {
        ai_monthly_tokens: 500000, // 500k used out of 1M limit
        ai_tokens_reset_at: "2026-05-01T00:00:00Z",
      },
    }));
    
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: { ...mockProfile, role: "super_admin" },
    });

    const { POST } = await import("@/app/api/chat/route");
    
    const request = createMockRequest({
      messages: [
        {
          role: "user",
          content: "This should be allowed for super admin.",
        },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("should reset budget at month boundary", async () => {
    const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
    const { requireTenant } = vi.mocked(await import("@/lib/tenant"));
    
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    createClient.mockReturnValue({
      ...createMockSupabaseClient({
        clinicData: {
          ai_monthly_tokens: 45000, // High usage from previous month
          ai_tokens_reset_at: "2026-04-01T00:00:00Z", // Previous month
        },
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ai_monthly_tokens: 45000,
                ai_tokens_reset_at: "2026-04-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
        update: mockUpdate,
      }),
    } as unknown as SupabaseClient);
    
    requireTenant.mockResolvedValue({
      clinicId: "clinic-123",
      profile: mockProfile,
    });

    const { POST } = await import("@/app/api/chat/route");
    
    const request = createMockRequest({
      messages: [
        {
          role: "user",
          content: "This should work after reset.",
        },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    
    // Verify reset was called
    expect(mockUpdate).toHaveBeenCalledWith({
      ai_monthly_tokens: 0,
      ai_tokens_reset_at: expect.stringMatching(/2026-05-01T00:00:00/),
    });
  });
});