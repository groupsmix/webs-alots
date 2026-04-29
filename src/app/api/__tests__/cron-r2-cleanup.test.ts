/**
 * Integration tests for `src/app/api/cron/r2-cleanup/route.ts` (Task 3.3.3).
 *
 * Verifies:
 *   1. CRON_SECRET authentication (the standard cron-auth pattern shared
 *      with `cron-reminders.test.ts` and `billing.test.ts`).
 *   2. Per-clinic iteration — the route lists active clinics and calls
 *      the per-clinic primitives in `@/lib/r2-cleanup` once per clinic
 *      with the correct `clinic_id`-scoped prefix (AGENTS.md rule #6).
 *   3. Aggregate response shape — `{ scanned, orphans, deleted }` plus
 *      per-clinic breakdown and the alert flag bubbled up from
 *      `reconcileOrphans`.
 *   4. Resilience — a sweep that throws for one clinic must not abort
 *      the rest of the pass.
 *   5. Alert propagation — `alertEmitted` reflects whether any clinic's
 *      orphan rate crossed the configured threshold.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

/* ─── Module mocks ─── */

const mockCleanupAbandoned = vi.fn();
const mockReconcileOrphans = vi.fn();
const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/r2-cleanup", () => ({
  cleanupAbandonedUploads: (...args: unknown[]) =>
    mockCleanupAbandoned(...args),
  reconcileOrphans: (...args: unknown[]) => mockReconcileOrphans(...args),
}));

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createClient: vi.fn(),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/sentry-cron", () => ({
  // Pass-through wrapper so the route's GET export is just the handler
  // — keeps the test focused on route behaviour, not Sentry plumbing.
  withSentryCron: (
    _slug: string,
    _schedule: string,
    handler: (req: unknown) => unknown,
  ) => handler,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/assert-tenant", () => ({
  // The real helper validates UUIDs; the test fixtures use UUID strings,
  // so just defer to a no-op for the route-level test.
  assertClinicId: vi.fn(),
}));

/* ─── Test helpers ─── */

const VALID_UUID_A = "11111111-1111-1111-1111-111111111111";
const VALID_UUID_B = "22222222-2222-2222-2222-222222222222";

interface ClinicRow {
  id: string;
}

function makeAdminClient(clinics: ClinicRow[], queryError: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data: clinics, error: queryError });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, _select: select, _eq: eq };
}

function buildAuthorizedRequest(): Request {
  return new Request("http://localhost/api/cron/r2-cleanup", {
    headers: {
      authorization: "Bearer test-secret",
    },
  }) as unknown as Request;
}

/* ─── Tests ─── */

describe("Cron r2-cleanup — authentication", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects requests without a bearer token (401)", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const req = new Request(
      "http://localhost/api/cron/r2-cleanup",
    ) as unknown as Request;
    const res = (await GET(req as never)) as Response;
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong bearer token (401)", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const req = new Request("http://localhost/api/cron/r2-cleanup", {
      headers: { authorization: "Bearer not-the-secret" },
    }) as unknown as Request;
    const res = (await GET(req as never)) as Response;
    expect(res.status).toBe(401);
  });

  it("rejects requests when CRON_SECRET is unset (401)", async () => {
    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const req = buildAuthorizedRequest();
    const res = (await GET(req as never)) as Response;
    expect(res.status).toBe(401);
  });

  it("does NOT call any cleanup primitives on a 401", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    await GET(
      new Request(
        "http://localhost/api/cron/r2-cleanup",
      ) as unknown as never,
    );
    expect(mockCleanupAbandoned).not.toHaveBeenCalled();
    expect(mockReconcileOrphans).not.toHaveBeenCalled();
  });
});

describe("Cron r2-cleanup — per-clinic iteration (AGENTS.md rule #6)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("queries clinics filtered by status='active'", async () => {
    const adminClient = makeAdminClient([]);
    mockCreateAdminClient.mockReturnValue(adminClient);

    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    await GET(buildAuthorizedRequest() as unknown as never);

    expect(adminClient.from).toHaveBeenCalledWith("clinics");
    expect(adminClient._select).toHaveBeenCalledWith("id");
    expect(adminClient._eq).toHaveBeenCalledWith("status", "active");
  });

  it("calls cleanup primitives once per active clinic with a clinic-scoped prefix", async () => {
    const adminClient = makeAdminClient([
      { id: VALID_UUID_A },
      { id: VALID_UUID_B },
    ]);
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCleanupAbandoned.mockResolvedValue({
      scanned: 0,
      deletedFromR2: 0,
      removedFromDb: 0,
      errors: [],
      dryRun: false,
    });
    mockReconcileOrphans.mockResolvedValue({
      scanned: 0,
      orphans: 0,
      deletedFromR2: 0,
      orphanRate: 0,
      alerted: false,
      dryRun: false,
      errors: [],
    });

    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    await GET(buildAuthorizedRequest() as unknown as never);

    expect(mockCleanupAbandoned).toHaveBeenCalledTimes(2);
    expect(mockReconcileOrphans).toHaveBeenCalledTimes(2);

    // Per AGENTS.md rule #6, every call must pass the clinic_id and a
    // prefix scoped to that clinic — NEVER a bucket-wide prefix.
    expect(mockCleanupAbandoned).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      VALID_UUID_A,
      { prefix: `clinics/${VALID_UUID_A}/` },
    );
    expect(mockReconcileOrphans).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      VALID_UUID_A,
      { prefix: `clinics/${VALID_UUID_A}/` },
    );
    expect(mockCleanupAbandoned).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      VALID_UUID_B,
      { prefix: `clinics/${VALID_UUID_B}/` },
    );
    expect(mockReconcileOrphans).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      VALID_UUID_B,
      { prefix: `clinics/${VALID_UUID_B}/` },
    );
  });

  it("returns 500 when the active-clinics query fails", async () => {
    const adminClient = makeAdminClient([], { message: "boom" });
    mockCreateAdminClient.mockReturnValue(adminClient);

    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const res = (await GET(buildAuthorizedRequest() as unknown as never)) as
      Response;
    expect(res.status).toBe(500);
    expect(mockCleanupAbandoned).not.toHaveBeenCalled();
    expect(mockReconcileOrphans).not.toHaveBeenCalled();
  });
});

describe("Cron r2-cleanup — aggregate response", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns { scanned, orphans, deleted } summed across clinics", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient([{ id: VALID_UUID_A }, { id: VALID_UUID_B }]),
    );
    (mockCleanupAbandoned as Mock)
      .mockResolvedValueOnce({
        scanned: 3,
        deletedFromR2: 2,
        removedFromDb: 2,
        errors: [],
        dryRun: false,
      })
      .mockResolvedValueOnce({
        scanned: 1,
        deletedFromR2: 1,
        removedFromDb: 1,
        errors: [{ key: "k", stage: "r2", error: "x" }],
        dryRun: false,
      });
    (mockReconcileOrphans as Mock)
      .mockResolvedValueOnce({
        scanned: 10,
        orphans: 1,
        deletedFromR2: 1,
        orphanRate: 0.1,
        alerted: false,
        dryRun: false,
        errors: [],
      })
      .mockResolvedValueOnce({
        scanned: 20,
        orphans: 4,
        deletedFromR2: 4,
        orphanRate: 0.2,
        alerted: true,
        dryRun: false,
        errors: [],
      });

    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const res = (await GET(buildAuthorizedRequest() as unknown as never)) as
      Response;
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      data: {
        scanned: number;
        orphans: number;
        deleted: number;
        errors: number;
        clinics: number;
        alertEmitted: boolean;
        perClinic: Array<{
          clinicId: string;
          scanned: number;
          orphans: number;
          deleted: number;
          alerted: boolean;
        }>;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.data.clinics).toBe(2);
    expect(body.data.scanned).toBe(30); // 10 + 20 from reconcileOrphans
    expect(body.data.orphans).toBe(5); // 1 + 4
    expect(body.data.deleted).toBe(8); // (2+1) + (1+4)
    expect(body.data.errors).toBe(1);
    expect(body.data.alertEmitted).toBe(true);
    expect(body.data.perClinic).toHaveLength(2);
    expect(body.data.perClinic[0].clinicId).toBe(VALID_UUID_A);
    expect(body.data.perClinic[1].alerted).toBe(true);
  });

  it("alertEmitted is false when no clinic crosses the threshold", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient([{ id: VALID_UUID_A }]),
    );
    mockCleanupAbandoned.mockResolvedValue({
      scanned: 0,
      deletedFromR2: 0,
      removedFromDb: 0,
      errors: [],
      dryRun: false,
    });
    mockReconcileOrphans.mockResolvedValue({
      scanned: 100,
      orphans: 1,
      deletedFromR2: 1,
      orphanRate: 0.01,
      alerted: false,
      dryRun: false,
      errors: [],
    });

    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const res = (await GET(buildAuthorizedRequest() as unknown as never)) as
      Response;
    const body = (await res.json()) as { data: { alertEmitted: boolean } };
    expect(body.data.alertEmitted).toBe(false);
  });
});

describe("Cron r2-cleanup — per-clinic resilience", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not abort the pass when one clinic's sweep throws", async () => {
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient([{ id: VALID_UUID_A }, { id: VALID_UUID_B }]),
    );
    (mockCleanupAbandoned as Mock)
      .mockRejectedValueOnce(new Error("kaboom"))
      .mockResolvedValueOnce({
        scanned: 1,
        deletedFromR2: 1,
        removedFromDb: 1,
        errors: [],
        dryRun: false,
      });
    mockReconcileOrphans.mockResolvedValue({
      scanned: 5,
      orphans: 0,
      deletedFromR2: 0,
      orphanRate: 0,
      alerted: false,
      dryRun: false,
      errors: [],
    });

    const { GET } = await import("@/app/api/cron/r2-cleanup/route");
    const res = (await GET(buildAuthorizedRequest() as unknown as never)) as
      Response;
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: {
        clinics: number;
        errors: number;
        deleted: number;
        perClinic: Array<{ clinicId: string; error?: string }>;
      };
    };
    expect(body.data.clinics).toBe(2);
    expect(body.data.errors).toBeGreaterThanOrEqual(1);
    expect(body.data.deleted).toBe(1); // only the second clinic's delete counted
    expect(body.data.perClinic.find((c) => c.clinicId === VALID_UUID_A)?.error).toBe(
      "kaboom",
    );
  });
});
