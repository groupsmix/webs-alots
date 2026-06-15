import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logAuditEvent } from "@/lib/audit-log";
import { isAiDisabledByEnv } from "@/lib/env";
import { getKVBinding } from "@/lib/features";
import { createUntypedAdminClient } from "@/lib/supabase-server";

const mockKv = {
  get: vi.fn(),
  put: vi.fn(),
};

const mockAuthContext = {
  supabase: {},
  user: { id: "auth-user-1" },
  profile: { id: "profile-1", role: "super_admin", clinic_id: null },
};

const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
    })),
  })),
}));

const mockUntypedAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "ai_feature_toggles") {
      return {
        select: vi.fn(() => ({
          order: mockOrder,
        })),
        update: mockUpdate,
      };
    }

    return {
      select: vi.fn(() => ({
        order: mockOrder,
      })),
      update: mockUpdate,
    };
  }),
};

type Handler = (request: NextRequest, auth: typeof mockAuthContext) => Promise<Response>;

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: Handler) => (request: NextRequest) => handler(request, mockAuthContext),
}));

vi.mock("@/lib/features", () => ({
  getKVBinding: vi.fn(async () => mockKv),
}));

vi.mock("@/lib/env", () => ({
  isAiDisabledByEnv: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => mockUntypedAdminClient),
}));

function buildRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/super-admin/feature-flags", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/super-admin/feature-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiDisabledByEnv).mockReturnValue(false);
    vi.mocked(getKVBinding).mockResolvedValue(mockKv);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createUntypedAdminClient).mockReturnValue(mockUntypedAdminClient as any);
    mockKv.get.mockResolvedValue(null);
    mockKv.put.mockResolvedValue(undefined);
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: { feature_key: "support_draft" }, error: null });
  });

  it("returns registered runtime flags with their current state", async () => {
    mockKv.get.mockResolvedValueOnce("false");

    const { GET } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await GET(buildRequest("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.kvAvailable).toBe(true);
    expect(body.data.flags).toEqual([
      expect.objectContaining({
        key: "ai.enabled",
        enabled: false,
        displayName: "Global AI Kill Switch",
        category: "core",
        locked: false,
        source: "kv",
        minTier: null,
      }),
    ]);
  });

  it("includes AI database feature toggles on the page payload", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        {
          feature_key: "support_draft",
          display_name: "Support Draft Responses",
          description: "AI-drafted responses for support tickets",
          is_enabled: true,
          min_tier: 1,
        },
      ],
      error: null,
    });

    const { GET } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await GET(buildRequest("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "support_draft",
          displayName: "Support Draft Responses",
          enabled: true,
          category: "integration",
          source: "db",
          minTier: 1,
        }),
      ]),
    );
  });

  it("reports the AI flag as disabled and locked when the env override is active", async () => {
    vi.mocked(isAiDisabledByEnv).mockReturnValue(true);
    mockKv.get.mockResolvedValueOnce("true");

    const { GET } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await GET(buildRequest("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.flags[0]).toMatchObject({
      key: "ai.enabled",
      enabled: false,
      locked: true,
    });
  });
});

describe("PUT /api/super-admin/feature-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiDisabledByEnv).mockReturnValue(false);
    vi.mocked(getKVBinding).mockResolvedValue(mockKv);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createUntypedAdminClient).mockReturnValue(mockUntypedAdminClient as any);
    mockKv.get.mockResolvedValue(null);
    mockKv.put.mockResolvedValue(undefined);
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: { feature_key: "support_draft" }, error: null });
  });

  it("validates malformed JSON bodies", async () => {
    const { PUT } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await PUT(
      new NextRequest("http://localhost/api/super-admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/invalid json body/i);
  });

  it("rejects unknown feature flag keys", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { PUT } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await PUT(
      buildRequest("PUT", {
        key: "unknown.flag",
        enabled: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/unknown feature flag key/i);
  });

  it("writes flag updates to KV and logs an audit event", async () => {
    const { PUT } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await PUT(
      buildRequest("PUT", {
        key: "ai.enabled",
        enabled: false,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ key: "ai.enabled", enabled: false });
    expect(mockKv.put).toHaveBeenCalledWith("ai.enabled", "false");
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "feature_flag_updated",
        clinicId: "system",
        actor: "profile-1",
        metadata: expect.objectContaining({
          key: "ai.enabled",
          enabled: false,
        }),
      }),
    );
  });

  it("blocks re-enabling a flag when an env lock is active", async () => {
    vi.mocked(isAiDisabledByEnv).mockReturnValue(true);

    const { PUT } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await PUT(
      buildRequest("PUT", {
        key: "ai.enabled",
        enabled: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("FLAG_LOCKED");
    expect(mockKv.put).not.toHaveBeenCalled();
  });

  it("returns 503 when feature flag storage is unavailable", async () => {
    vi.mocked(getKVBinding).mockResolvedValueOnce(undefined);

    const { PUT } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await PUT(
      buildRequest("PUT", {
        key: "ai.enabled",
        enabled: false,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("KV_UNAVAILABLE");
  });

  it("updates database-backed AI feature toggles through the same route", async () => {
    const { PUT } = await import("@/app/api/super-admin/feature-flags/route");
    const response = await PUT(
      buildRequest("PUT", {
        key: "support_draft",
        enabled: true,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ key: "support_draft", enabled: true });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_enabled: true,
      }),
    );
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "feature_flag_updated",
        metadata: expect.objectContaining({
          key: "support_draft",
          enabled: true,
        }),
      }),
    );
  });
});
