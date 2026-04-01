import { vi } from "vitest";

/**
 * Shared test utilities for consistent mocking across test files.
 *
 * Addresses audit finding L9-04: test setup does not provide global mocks
 * for Supabase client or tenant context, leading to inconsistent mock
 * patterns across test files.
 */

/**
 * Create a mock Supabase client with chainable query builder methods.
 *
 * Usage:
 * ```ts
 * const supabase = createMockSupabase();
 * vi.mock("@/lib/supabase-server", () => ({
 *   createClient: () => supabase,
 * }));
 * ```
 */
export function createMockSupabase() {
  const queryBuilder = {
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
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "" } }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
    /** Access the underlying query builder to configure per-test return values */
    _queryBuilder: queryBuilder,
  };
}

/**
 * Create a mock tenant context.
 *
 * Usage:
 * ```ts
 * const tenant = createMockTenant({ clinicName: "Test Clinic" });
 * vi.mock("@/lib/tenant", () => ({
 *   getTenant: () => tenant,
 *   requireTenant: () => tenant,
 * }));
 * ```
 */
export function createMockTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    clinicId: "clinic-test-001",
    clinicName: "Test Clinic",
    subdomain: "test",
    clinicType: "general",
    locale: "fr",
    timezone: "Africa/Casablanca",
    ...overrides,
  };
}

interface MockTenant {
  clinicId: string;
  clinicName: string;
  subdomain: string;
  clinicType: string;
  locale: string;
  timezone: string;
}

/**
 * Create a mock user profile.
 */
export function createMockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: "user-test-001",
    clinic_id: "clinic-test-001",
    role: "patient",
    name: "Test User",
    email: "test@example.com",
    ...overrides,
  };
}

interface MockProfile {
  id: string;
  clinic_id: string;
  role: string;
  name: string;
  email: string;
}
