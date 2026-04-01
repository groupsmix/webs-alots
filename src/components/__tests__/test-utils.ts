/**
 * Shared test utilities for consistent mock patterns across test files.
 *
 * Audit L9-04: Centralises Supabase, tenant, and logger mocks so that
 * individual test files don't need to reinvent these patterns.
 */
import { vi } from "vitest";

/* ---------- Supabase mock ---------- */

/**
 * Creates a mock Supabase client with chainable query builder methods.
 * Supports `.from().select().eq().single()` and similar patterns.
 */
export function createMockSupabaseClient(overrides?: {
  user?: { id: string } | null;
  profile?: Record<string, unknown> | null;
  queryData?: unknown;
  queryError?: { message: string } | null;
}) {
  const {
    user = null,
    profile = null,
    queryData = null,
    queryError = null,
  } = overrides ?? {};

  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: queryData ?? profile,
      error: queryError,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: queryData ?? profile,
      error: queryError,
    }),
    then: undefined as unknown,
  };

  // Make chainable resolve as a promise when awaited directly
  chainable.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve({ data: queryData ? [queryData] : [], error: queryError }),
  );

  return {
    from: vi.fn().mockReturnValue(chainable),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user }, error: null }),
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: user ? { user } : null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: "test.png" }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/test.png" } }),
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    /** Direct reference to the chainable builder for custom assertions. */
    _chainable: chainable,
  };
}

/* ---------- Tenant mock ---------- */

export interface MockTenant {
  clinicId: string;
  clinicName: string;
  subdomain: string;
  clinicType: string;
  clinicTier: string;
}

export const DEFAULT_MOCK_TENANT: MockTenant = {
  clinicId: "clinic-test-1",
  clinicName: "Test Clinic",
  subdomain: "test",
  clinicType: "doctor",
  clinicTier: "pro",
};

/**
 * Returns a mock header map for tenant context, suitable for mocking
 * `next/headers` in server-side tests.
 */
export function createMockTenantHeaders(
  tenant: Partial<MockTenant> = {},
): { get: ReturnType<typeof vi.fn> } {
  const t = { ...DEFAULT_MOCK_TENANT, ...tenant };
  const map: Record<string, string> = {
    "x-tenant-clinic-id": t.clinicId,
    "x-tenant-clinic-name": t.clinicName,
    "x-tenant-subdomain": t.subdomain,
    "x-tenant-clinic-type": t.clinicType,
    "x-tenant-clinic-tier": t.clinicTier,
  };
  return { get: vi.fn((name: string) => map[name] ?? null) };
}

/* ---------- Logger mock ---------- */

/** Silent logger mock — prevents noisy output during tests. */
export const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

/* ---------- Request helpers ---------- */

/** Creates a minimal mock Request for API route handler tests. */
export function createMockRequest(
  url = "http://localhost:3000/api/test",
  init?: RequestInit,
): Request {
  return new Request(url, init);
}

/** Creates a JSON POST request for API route handler tests. */
export function createJsonRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
