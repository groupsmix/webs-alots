/**
 * Unit tests for `src/lib/r2-cleanup.ts` (Task 3.3.2).
 *
 * Covers:
 *   1. `findAbandonedPendingUploads` — builds the correct PostgREST query
 *      (confirmed_at IS NULL + created_at < cutoff + limit + optional
 *      prefix filter) and surfaces errors.
 *   2. `findOrphanKeys` — returns only keys not present in
 *      `pending_uploads`, de-duplicates input, and short-circuits on an
 *      empty input array.
 *   3. `cleanupAbandonedUploads` — deletes each row from R2 and the DB,
 *      honours `dryRun`, and aggregates per-key errors without aborting.
 *   4. `reconcileOrphans` — enumerates R2, classifies orphans via the DB
 *      query, deletes the orphans (unless `dryRun`), computes the orphan
 *      rate, and fires `emitOrphanRateAlert` exactly once per pass.
 *   5. `emitOrphanRateAlert` — verifies both the threshold-exceeded path
 *      (logger.error + Sentry.captureMessage with the expected tags) and
 *      the sub-threshold / zero-total no-op paths.
 *   6. `readOrphanRateAlertThreshold` — honours the env override and
 *      falls back to the 0.1 default when the value is missing or
 *      invalid.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";

/* ─── Module mocks ─── */

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/r2", () => ({
  listR2Objects: vi.fn(),
  deleteFromR2: vi.fn(),
}));

/* ─── Test helpers ─── */

type QueryResult<T> = { data: T | null; error: { message: string } | null };

/**
 * Build a chainable Supabase mock for the `pending_uploads` table.
 * Chainable query methods return the same stub; the final `resolver`
 * decides what `await` resolves to, which lets tests assert on the
 * exact filters applied.
 */
function makeSupabaseStub() {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // Awaiting the builder resolves with whatever the current resolver
    // returns. Tests can swap the resolver per scenario.
    _resolver: vi.fn<() => Promise<QueryResult<unknown>>>().mockResolvedValue({
      data: [],
      error: null,
    }),
    then<T>(onFulfilled: (value: QueryResult<unknown>) => T) {
      return builder._resolver().then(onFulfilled);
    },
  };

  const client = {
    from: vi.fn().mockReturnValue(builder),
  };

  return { client, builder };
}

/**
 * A valid-looking clinic UUID. The library calls `assertClinicId`
 * (which validates UUID shape) so the test fixture can't use the
 * `"clinic-a"` shorthand.
 */
const TEST_CLINIC_ID = "00000000-0000-0000-0000-000000000001";

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.R2_ORPHAN_RATE_ALERT_THRESHOLD;
});

afterEach(() => {
  process.env = originalEnv;
});

/* ─── readOrphanRateAlertThreshold ─── */

describe("readOrphanRateAlertThreshold", () => {
  it("returns the default (0.1) when the env var is unset", async () => {
    const { readOrphanRateAlertThreshold, DEFAULT_ORPHAN_RATE_THRESHOLD } =
      await import("../r2-cleanup");
    expect(readOrphanRateAlertThreshold()).toBe(DEFAULT_ORPHAN_RATE_THRESHOLD);
  });

  it("honours a valid override in [0, 1]", async () => {
    process.env.R2_ORPHAN_RATE_ALERT_THRESHOLD = "0.25";
    const { readOrphanRateAlertThreshold } = await import("../r2-cleanup");
    expect(readOrphanRateAlertThreshold()).toBe(0.25);
  });

  it("falls back to the default when the value is non-numeric", async () => {
    process.env.R2_ORPHAN_RATE_ALERT_THRESHOLD = "abc";
    const { readOrphanRateAlertThreshold, DEFAULT_ORPHAN_RATE_THRESHOLD } =
      await import("../r2-cleanup");
    expect(readOrphanRateAlertThreshold()).toBe(DEFAULT_ORPHAN_RATE_THRESHOLD);
  });

  it("falls back to the default when the value is out of range", async () => {
    process.env.R2_ORPHAN_RATE_ALERT_THRESHOLD = "2.5";
    const { readOrphanRateAlertThreshold, DEFAULT_ORPHAN_RATE_THRESHOLD } =
      await import("../r2-cleanup");
    expect(readOrphanRateAlertThreshold()).toBe(DEFAULT_ORPHAN_RATE_THRESHOLD);
  });
});

/* ─── findAbandonedPendingUploads ─── */

describe("findAbandonedPendingUploads", () => {
  it("builds the cutoff query with default 24 h window and selects the tracked columns", async () => {
    const { findAbandonedPendingUploads } = await import("../r2-cleanup");
    const { client, builder } = makeSupabaseStub();
    const rows = [
      {
        id: "row-1",
        clinic_id: "clinic-a",
        r2_key: "clinics/clinic-a/logos/abc.png",
        content_type: "image/png",
        created_at: "2024-01-01T00:00:00Z",
        confirmed_at: null,
      },
    ];
    builder._resolver.mockResolvedValueOnce({ data: rows, error: null });

    const before = Date.now();
    const result = await findAbandonedPendingUploads(
      client as unknown as Parameters<typeof findAbandonedPendingUploads>[0],
      TEST_CLINIC_ID,
    );
    const after = Date.now();

    expect(result).toEqual(rows);
    expect(client.from).toHaveBeenCalledWith("pending_uploads");
    expect(builder.select).toHaveBeenCalledWith(
      "id, clinic_id, r2_key, content_type, created_at, confirmed_at",
    );
    expect(builder.eq).toHaveBeenCalledWith("clinic_id", TEST_CLINIC_ID);
    expect(builder.is).toHaveBeenCalledWith("confirmed_at", null);

    const [ltColumn, ltValue] = builder.lt.mock.calls[0] as [string, string];
    expect(ltColumn).toBe("created_at");
    const cutoffMs = new Date(ltValue).getTime();
    const windowMs = 24 * 60 * 60 * 1000;
    expect(cutoffMs).toBeGreaterThanOrEqual(before - windowMs - 5);
    expect(cutoffMs).toBeLessThanOrEqual(after - windowMs + 5);

    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(1000);
    // No prefix → no like filter
    expect(builder.like).not.toHaveBeenCalled();
  });

  it("applies a prefix filter when provided", async () => {
    const { findAbandonedPendingUploads } = await import("../r2-cleanup");
    const { client, builder } = makeSupabaseStub();
    builder._resolver.mockResolvedValueOnce({ data: [], error: null });

    await findAbandonedPendingUploads(
      client as unknown as Parameters<typeof findAbandonedPendingUploads>[0],
      TEST_CLINIC_ID,
      { prefix: "clinics/clinic-a/", olderThanHours: 1, limit: 50 },
    );

    expect(builder.eq).toHaveBeenCalledWith("clinic_id", TEST_CLINIC_ID);

    expect(builder.like).toHaveBeenCalledWith("r2_key", "clinics/clinic-a/%");
    expect(builder.limit).toHaveBeenCalledWith(50);
  });

  it("throws when the Supabase query returns an error", async () => {
    const { findAbandonedPendingUploads } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");
    const { client, builder } = makeSupabaseStub();
    builder._resolver.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    await expect(
      findAbandonedPendingUploads(
        client as unknown as Parameters<typeof findAbandonedPendingUploads>[0],
        TEST_CLINIC_ID,
      ),
    ).rejects.toEqual({ message: "boom" });

    expect(logger.error).toHaveBeenCalledWith(
      "findAbandonedPendingUploads query failed",
      expect.objectContaining({ context: "r2-cleanup" }),
    );
  });
});

describe("tenant isolation guard", () => {
  it("findAbandonedPendingUploads rejects a missing clinicId before touching Supabase", async () => {
    const { findAbandonedPendingUploads } = await import("../r2-cleanup");
    const { client } = makeSupabaseStub();

    await expect(
      findAbandonedPendingUploads(
        client as unknown as Parameters<typeof findAbandonedPendingUploads>[0],
        "" as unknown as string,
      ),
    ).rejects.toThrow(/TENANT SAFETY/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("findOrphanKeys rejects a non-UUID clinicId before touching Supabase", async () => {
    const { findOrphanKeys } = await import("../r2-cleanup");
    const { client } = makeSupabaseStub();

    await expect(
      findOrphanKeys(
        client as unknown as Parameters<typeof findOrphanKeys>[0],
        "not-a-uuid",
        ["clinics/a/orphan.png"],
      ),
    ).rejects.toThrow(/TENANT SAFETY/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("cleanupAbandonedUploads rejects a missing clinicId before touching Supabase", async () => {
    const { cleanupAbandonedUploads } = await import("../r2-cleanup");
    const { client } = makeSupabaseStub();

    await expect(
      cleanupAbandonedUploads(
        client as unknown as Parameters<typeof cleanupAbandonedUploads>[0],
        undefined as unknown as string,
      ),
    ).rejects.toThrow(/TENANT SAFETY/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reconcileOrphans rejects a missing clinicId before listing R2", async () => {
    const { reconcileOrphans } = await import("../r2-cleanup");
    const { listR2Objects } = await import("@/lib/r2");
    const { client } = makeSupabaseStub();

    await expect(
      reconcileOrphans(
        client as unknown as Parameters<typeof reconcileOrphans>[0],
        "" as unknown as string,
        { prefix: "clinics/" },
      ),
    ).rejects.toThrow(/TENANT SAFETY/);
    expect(listR2Objects).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });
});

/* ─── findOrphanKeys ─── */

describe("findOrphanKeys", () => {
  it("short-circuits on an empty input without querying Supabase", async () => {
    const { findOrphanKeys } = await import("../r2-cleanup");
    const { client } = makeSupabaseStub();

    const result = await findOrphanKeys(
      client as unknown as Parameters<typeof findOrphanKeys>[0],
      TEST_CLINIC_ID,
      [],
    );

    expect(result).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns keys not present in pending_uploads, de-duplicating input", async () => {
    const { findOrphanKeys } = await import("../r2-cleanup");
    const { client, builder } = makeSupabaseStub();
    builder._resolver.mockResolvedValueOnce({
      data: [{ r2_key: "clinics/a/logos/known.png" }],
      error: null,
    });

    const input = [
      "clinics/a/logos/known.png",
      "clinics/a/logos/known.png", // duplicate
      "clinics/a/logos/orphan-1.png",
      "clinics/a/logos/orphan-2.png",
    ];
    const result = await findOrphanKeys(
      client as unknown as Parameters<typeof findOrphanKeys>[0],
      TEST_CLINIC_ID,
      input,
    );

    expect(result).toEqual([
      "clinics/a/logos/orphan-1.png",
      "clinics/a/logos/orphan-2.png",
    ]);
    expect(builder.eq).toHaveBeenCalledWith("clinic_id", TEST_CLINIC_ID);
    expect(builder.in).toHaveBeenCalledWith(
      "r2_key",
      [
        "clinics/a/logos/known.png",
        "clinics/a/logos/orphan-1.png",
        "clinics/a/logos/orphan-2.png",
      ],
    );
  });

  it("throws and logs when the Supabase query errors", async () => {
    const { findOrphanKeys } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");
    const { client, builder } = makeSupabaseStub();
    builder._resolver.mockResolvedValueOnce({
      data: null,
      error: { message: "db down" },
    });

    await expect(
      findOrphanKeys(
        client as unknown as Parameters<typeof findOrphanKeys>[0],
        TEST_CLINIC_ID,
        ["k1"],
      ),
    ).rejects.toEqual({ message: "db down" });

    expect(logger.error).toHaveBeenCalledWith(
      "findOrphanKeys query failed",
      expect.objectContaining({ context: "r2-cleanup", keyCount: 1 }),
    );
  });
});

/* ─── cleanupAbandonedUploads ─── */

describe("cleanupAbandonedUploads", () => {
  const abandoned = [
    {
      id: "row-1",
      clinic_id: "clinic-a",
      r2_key: "clinics/a/logos/abandoned-1.png",
      content_type: "image/png",
      created_at: "2024-01-01T00:00:00Z",
      confirmed_at: null,
    },
    {
      id: "row-2",
      clinic_id: "clinic-a",
      r2_key: "clinics/a/logos/abandoned-2.png",
      content_type: "image/png",
      created_at: "2024-01-01T01:00:00Z",
      confirmed_at: null,
    },
  ];

  it("deletes each abandoned key from R2 and the DB row on success", async () => {
    const { cleanupAbandonedUploads } = await import("../r2-cleanup");
    const { deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    // First await (select) returns abandoned rows; each subsequent await
    // (one per row's delete().eq()) returns a successful delete result.
    builder._resolver
      .mockResolvedValueOnce({ data: abandoned, error: null })
      .mockResolvedValue({ data: null, error: null });

    (deleteFromR2 as Mock).mockResolvedValue(undefined);

    const result = await cleanupAbandonedUploads(
      client as unknown as Parameters<typeof cleanupAbandonedUploads>[0],
      TEST_CLINIC_ID,
    );

    expect(deleteFromR2).toHaveBeenCalledTimes(2);
    expect(deleteFromR2).toHaveBeenNthCalledWith(1, abandoned[0].r2_key);
    expect(deleteFromR2).toHaveBeenNthCalledWith(2, abandoned[1].r2_key);

    expect(builder.delete).toHaveBeenCalledTimes(2);
    // Each delete is scoped by both clinic_id (tenant guard) and id (target row).
    expect(builder.eq).toHaveBeenCalledWith("clinic_id", TEST_CLINIC_ID);
    expect(builder.eq).toHaveBeenCalledWith("id", "row-1");
    expect(builder.eq).toHaveBeenCalledWith("id", "row-2");

    expect(result).toEqual({
      scanned: 2,
      deletedFromR2: 2,
      removedFromDb: 2,
      errors: [],
      dryRun: false,
    });
  });

  it("dryRun skips all mutating calls and returns zero counters", async () => {
    const { cleanupAbandonedUploads } = await import("../r2-cleanup");
    const { deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();
    builder._resolver.mockResolvedValueOnce({ data: abandoned, error: null });

    const result = await cleanupAbandonedUploads(
      client as unknown as Parameters<typeof cleanupAbandonedUploads>[0],
      TEST_CLINIC_ID,
      { dryRun: true },
    );

    expect(deleteFromR2).not.toHaveBeenCalled();
    expect(builder.delete).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      scanned: 2,
      deletedFromR2: 0,
      removedFromDb: 0,
      dryRun: true,
    });
  });

  it("records R2 delete failures and skips the DB delete for that row", async () => {
    const { cleanupAbandonedUploads } = await import("../r2-cleanup");
    const { deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    builder._resolver
      .mockResolvedValueOnce({ data: abandoned, error: null })
      // Only one DB delete will be issued — for the second (successful) R2 delete.
      .mockResolvedValueOnce({ data: null, error: null });

    (deleteFromR2 as Mock)
      .mockRejectedValueOnce(new Error("r2 timeout"))
      .mockResolvedValueOnce(undefined);

    const result = await cleanupAbandonedUploads(
      client as unknown as Parameters<typeof cleanupAbandonedUploads>[0],
      TEST_CLINIC_ID,
    );

    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(result.scanned).toBe(2);
    expect(result.deletedFromR2).toBe(1);
    expect(result.removedFromDb).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ key: abandoned[0].r2_key, stage: "r2" }),
    ]);
  });

  it("records DB delete failures after a successful R2 delete", async () => {
    const { cleanupAbandonedUploads } = await import("../r2-cleanup");
    const { deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    builder._resolver
      .mockResolvedValueOnce({ data: [abandoned[0]], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "db write failed" },
      });

    (deleteFromR2 as Mock).mockResolvedValue(undefined);

    const result = await cleanupAbandonedUploads(
      client as unknown as Parameters<typeof cleanupAbandonedUploads>[0],
      TEST_CLINIC_ID,
    );

    expect(result.deletedFromR2).toBe(1);
    expect(result.removedFromDb).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({ key: abandoned[0].r2_key, stage: "db" }),
    ]);
  });
});

/* ─── reconcileOrphans ─── */

describe("reconcileOrphans", () => {
  it("lists R2, deletes orphans, and returns accurate counters", async () => {
    const { reconcileOrphans } = await import("../r2-cleanup");
    const { listR2Objects, deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    (listR2Objects as Mock).mockResolvedValue([
      "clinics/a/logos/known.png",
      "clinics/a/logos/orphan-1.png",
      "clinics/a/logos/orphan-2.png",
    ]);
    builder._resolver.mockResolvedValueOnce({
      data: [{ r2_key: "clinics/a/logos/known.png" }],
      error: null,
    });
    (deleteFromR2 as Mock).mockResolvedValue(undefined);

    const result = await reconcileOrphans(
      client as unknown as Parameters<typeof reconcileOrphans>[0],
      TEST_CLINIC_ID,
      { prefix: "clinics/a/" },
    );

    expect(builder.eq).toHaveBeenCalledWith("clinic_id", TEST_CLINIC_ID);

    expect(listR2Objects).toHaveBeenCalledWith("clinics/a/", undefined);
    expect(deleteFromR2).toHaveBeenCalledTimes(2);
    expect(deleteFromR2).toHaveBeenCalledWith("clinics/a/logos/orphan-1.png");
    expect(deleteFromR2).toHaveBeenCalledWith("clinics/a/logos/orphan-2.png");

    expect(result).toMatchObject({
      scanned: 3,
      orphans: 2,
      deletedFromR2: 2,
      orphanRate: 2 / 3,
      alerted: true,
      dryRun: false,
      errors: [],
    });
  });

  it("dryRun does not delete any R2 objects", async () => {
    const { reconcileOrphans } = await import("../r2-cleanup");
    const { listR2Objects, deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    (listR2Objects as Mock).mockResolvedValue([
      "clinics/a/logos/orphan.png",
    ]);
    builder._resolver.mockResolvedValueOnce({ data: [], error: null });

    const result = await reconcileOrphans(
      client as unknown as Parameters<typeof reconcileOrphans>[0],
      TEST_CLINIC_ID,
      { prefix: "clinics/a/", dryRun: true },
    );

    expect(deleteFromR2).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      scanned: 1,
      orphans: 1,
      deletedFromR2: 0,
      orphanRate: 1,
      alerted: true,
      dryRun: true,
    });
  });

  it("returns scanned=0 and orphanRate=0 when the prefix is empty", async () => {
    const { reconcileOrphans } = await import("../r2-cleanup");
    const { listR2Objects } = await import("@/lib/r2");
    const { client } = makeSupabaseStub();

    (listR2Objects as Mock).mockResolvedValue([]);

    const result = await reconcileOrphans(
      client as unknown as Parameters<typeof reconcileOrphans>[0],
      TEST_CLINIC_ID,
      { prefix: "clinics/empty/" },
    );

    expect(result).toMatchObject({
      scanned: 0,
      orphans: 0,
      deletedFromR2: 0,
      orphanRate: 0,
      alerted: false,
      errors: [],
    });
  });

  it("records per-key R2 delete errors without aborting the pass", async () => {
    const { reconcileOrphans } = await import("../r2-cleanup");
    const { listR2Objects, deleteFromR2 } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    (listR2Objects as Mock).mockResolvedValue([
      "clinics/a/orphan-1.png",
      "clinics/a/orphan-2.png",
    ]);
    builder._resolver.mockResolvedValueOnce({ data: [], error: null });
    (deleteFromR2 as Mock)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined);

    const result = await reconcileOrphans(
      client as unknown as Parameters<typeof reconcileOrphans>[0],
      TEST_CLINIC_ID,
      { prefix: "clinics/a/", alertThreshold: 0.99 },
    );

    expect(result.scanned).toBe(2);
    expect(result.orphans).toBe(2);
    expect(result.deletedFromR2).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ key: "clinics/a/orphan-1.png" }),
    ]);
  });

  it("forwards the limit option to listR2Objects when supplied", async () => {
    const { reconcileOrphans } = await import("../r2-cleanup");
    const { listR2Objects } = await import("@/lib/r2");
    const { client, builder } = makeSupabaseStub();

    (listR2Objects as Mock).mockResolvedValue([]);
    builder._resolver.mockResolvedValueOnce({ data: [], error: null });

    await reconcileOrphans(
      client as unknown as Parameters<typeof reconcileOrphans>[0],
      TEST_CLINIC_ID,
      { prefix: "clinics/", limit: 42 },
    );

    expect(listR2Objects).toHaveBeenCalledWith("clinics/", { limit: 42 });
  });
});

/* ─── emitOrphanRateAlert ─── */

describe("emitOrphanRateAlert", () => {
  it("fires logger.error AND Sentry.captureMessage when the rate is above the threshold", async () => {
    const { emitOrphanRateAlert } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");
    const Sentry = await import("@sentry/nextjs");

    const fired = emitOrphanRateAlert({
      orphanCount: 30,
      totalCount: 100,
      threshold: 0.1,
      prefix: "clinics/",
    });

    expect(fired).toBe(true);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "R2 orphan rate exceeded threshold",
      expect.objectContaining({
        context: "r2-cleanup",
        orphanCount: 30,
        totalCount: 100,
        orphanRate: 0.3,
        threshold: 0.1,
        prefix: "clinics/",
        tags: { alert: "r2_orphan_rate" },
      }),
    );

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "R2 orphan rate exceeded threshold",
      expect.objectContaining({
        level: "warning",
        tags: { alert: "r2_orphan_rate", prefix: "clinics/" },
        extra: expect.objectContaining({
          orphanCount: 30,
          totalCount: 100,
          orphanRate: 0.3,
          threshold: 0.1,
          prefix: "clinics/",
        }),
      }),
    );
  });

  it("fires at exactly the threshold boundary (>= comparison)", async () => {
    const { emitOrphanRateAlert } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");

    const fired = emitOrphanRateAlert({
      orphanCount: 1,
      totalCount: 10,
      threshold: 0.1,
    });

    expect(fired).toBe(true);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the orphan rate is below the threshold", async () => {
    const { emitOrphanRateAlert } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");
    const Sentry = await import("@sentry/nextjs");

    const fired = emitOrphanRateAlert({
      orphanCount: 1,
      totalCount: 100,
      threshold: 0.1,
    });

    expect(fired).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("no-ops when totalCount is zero (prevents divide-by-zero alerts)", async () => {
    const { emitOrphanRateAlert } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");
    const Sentry = await import("@sentry/nextjs");

    const fired = emitOrphanRateAlert({
      orphanCount: 0,
      totalCount: 0,
      threshold: 0.1,
    });

    expect(fired).toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("tags Sentry with 'unknown' when prefix is omitted", async () => {
    const { emitOrphanRateAlert } = await import("../r2-cleanup");
    const Sentry = await import("@sentry/nextjs");

    emitOrphanRateAlert({
      orphanCount: 5,
      totalCount: 10,
      threshold: 0.1,
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "R2 orphan rate exceeded threshold",
      expect.objectContaining({
        tags: { alert: "r2_orphan_rate", prefix: "unknown" },
      }),
    );
  });

  it("still reports success when Sentry.captureMessage throws", async () => {
    const { emitOrphanRateAlert } = await import("../r2-cleanup");
    const { logger } = await import("@/lib/logger");
    const Sentry = await import("@sentry/nextjs");

    (Sentry.captureMessage as unknown as Mock).mockImplementationOnce(() => {
      throw new Error("sentry offline");
    });

    const fired = emitOrphanRateAlert({
      orphanCount: 5,
      totalCount: 10,
      threshold: 0.1,
    });

    expect(fired).toBe(true);
    // The durable logger.error call is the primary alert signal.
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("uses the env-derived threshold when none is passed", async () => {
    process.env.R2_ORPHAN_RATE_ALERT_THRESHOLD = "0.5";
    const { emitOrphanRateAlert } = await import("../r2-cleanup");

    // 4/10 = 0.4 < 0.5 → no alert
    expect(
      emitOrphanRateAlert({ orphanCount: 4, totalCount: 10 }),
    ).toBe(false);

    // 6/10 = 0.6 >= 0.5 → alert
    expect(
      emitOrphanRateAlert({ orphanCount: 6, totalCount: 10 }),
    ).toBe(true);
  });
});
