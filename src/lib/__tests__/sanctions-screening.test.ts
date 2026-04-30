import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screenEntity, logScreeningResult } from "../sanctions-screening";
import type { ScreeningRequest } from "../sanctions-screening";

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("screenEntity", () => {
  const originalEnv = { ...process.env };

  const baseRequest: ScreeningRequest = {
    name: "Test Clinic",
    entityType: "organization",
    country: "MA",
    referenceId: "clinic-123",
    context: "clinic_onboarding",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns status=skipped when SANCTIONS_SCREENING_ENABLED is not true", async () => {
    delete process.env.SANCTIONS_SCREENING_ENABLED;
    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("skipped");
    expect(result.providerUsed).toBe(false);
  });

  it("returns status=error when enabled but no provider configured", async () => {
    process.env.SANCTIONS_SCREENING_ENABLED = "true";
    delete process.env.SANCTIONS_API_KEY;
    delete process.env.SANCTIONS_API_URL;
    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("error");
    expect(result.providerUsed).toBe(false);
  });

  it("returns clear when provider returns no matches", async () => {
    process.env.SANCTIONS_SCREENING_ENABLED = "true";
    process.env.SANCTIONS_API_KEY = "test-key";
    process.env.SANCTIONS_API_URL = "https://api.screening.test";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ matches: [] }),
    }));

    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("clear");
    expect(result.matchCount).toBe(0);
    expect(result.providerUsed).toBe(true);
  });

  it("returns match when provider returns high-score matches", async () => {
    process.env.SANCTIONS_SCREENING_ENABLED = "true";
    process.env.SANCTIONS_API_KEY = "test-key";
    process.env.SANCTIONS_API_URL = "https://api.screening.test";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        matches: [
          {
            listed_name: "Test Entity",
            list_source: "OFAC SDN",
            score: 95,
            list_entry_id: "SDN-12345",
          },
        ],
      }),
    }));

    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("match");
    expect(result.matchCount).toBe(1);
    expect(result.matches[0].listedName).toBe("Test Entity");
    expect(result.matches[0].listSource).toBe("OFAC SDN");
  });

  it("returns potential_match for low-score matches", async () => {
    process.env.SANCTIONS_SCREENING_ENABLED = "true";
    process.env.SANCTIONS_API_KEY = "test-key";
    process.env.SANCTIONS_API_URL = "https://api.screening.test";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        matches: [
          { listed_name: "Similar Name", list_source: "EU", score: 60 },
        ],
      }),
    }));

    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("potential_match");
  });

  it("returns error on network failure", async () => {
    process.env.SANCTIONS_SCREENING_ENABLED = "true";
    process.env.SANCTIONS_API_KEY = "test-key";
    process.env.SANCTIONS_API_URL = "https://api.screening.test";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("error");
    expect(result.providerUsed).toBe(false);
  });

  it("returns error on non-OK HTTP status", async () => {
    process.env.SANCTIONS_SCREENING_ENABLED = "true";
    process.env.SANCTIONS_API_KEY = "test-key";
    process.env.SANCTIONS_API_URL = "https://api.screening.test";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const result = await screenEntity(baseRequest);
    expect(result.status).toBe("error");
    expect(result.providerUsed).toBe(true);
  });
});

describe("logScreeningResult", () => {
  it("inserts screening result into sanctions_screenings table", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    };

    await logScreeningResult(
      mockSupabase,
      {
        name: "Test",
        entityType: "individual",
        referenceId: "ref-1",
        context: "clinic_onboarding",
      },
      {
        status: "clear",
        screeningId: "scr_123",
        matchCount: 0,
        matches: [],
        screenedAt: "2026-01-01T00:00:00Z",
        providerUsed: true,
      },
    );

    expect(mockSupabase.from).toHaveBeenCalledWith("sanctions_screenings");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        screening_id: "scr_123",
        reference_id: "ref-1",
        entity_type: "individual",
        status: "clear",
      }),
    );
  });

  it("does not throw on insert failure", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error("DB error");
      }),
    };

    // Should not throw
    await logScreeningResult(
      mockSupabase,
      {
        name: "Test",
        entityType: "individual",
        referenceId: "ref-1",
        context: "clinic_onboarding",
      },
      {
        status: "clear",
        screeningId: "scr_123",
        matchCount: 0,
        matches: [],
        screenedAt: "2026-01-01T00:00:00Z",
        providerUsed: false,
      },
    );
  });
});
