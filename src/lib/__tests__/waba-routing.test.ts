/**
 * Tests for src/lib/whatsapp/waba-routing.ts
 *
 * Covers:
 *   - resolveClinicFromWABA: DB lookup, caching, cache invalidation
 *   - resolvePatientFromPhone: phone normalization, patient lookup
 *   - isValidMoroccanPhone / normalizeMoroccanPhone
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("waba-routing — isValidMoroccanPhone", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates +212XXXXXXXXX format", async () => {
    const { isValidMoroccanPhone } = await import("@/lib/whatsapp/waba-routing");

    expect(isValidMoroccanPhone("+212612345678")).toBe(true);
    expect(isValidMoroccanPhone("+212712345678")).toBe(true);
  });

  it("validates 0XXXXXXXXX format", async () => {
    const { isValidMoroccanPhone } = await import("@/lib/whatsapp/waba-routing");

    expect(isValidMoroccanPhone("0612345678")).toBe(true);
    expect(isValidMoroccanPhone("0712345678")).toBe(true);
  });

  it("rejects invalid numbers", async () => {
    const { isValidMoroccanPhone } = await import("@/lib/whatsapp/waba-routing");

    expect(isValidMoroccanPhone("123")).toBe(false);
    expect(isValidMoroccanPhone("+33612345678")).toBe(false);
    expect(isValidMoroccanPhone("")).toBe(false);
  });
});

describe("waba-routing — normalizeMoroccanPhone", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes 06 to +212", async () => {
    const { normalizeMoroccanPhone } = await import("@/lib/whatsapp/waba-routing");

    expect(normalizeMoroccanPhone("0612345678")).toBe("+212612345678");
  });

  it("normalizes 212 to +212", async () => {
    const { normalizeMoroccanPhone } = await import("@/lib/whatsapp/waba-routing");

    expect(normalizeMoroccanPhone("212612345678")).toBe("+212612345678");
  });

  it("keeps +212 as-is", async () => {
    const { normalizeMoroccanPhone } = await import("@/lib/whatsapp/waba-routing");

    expect(normalizeMoroccanPhone("+212612345678")).toBe("+212612345678");
  });
});

describe("waba-routing — resolveClinicFromWABA", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockClient(clinicData: Record<string, unknown> | null) {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: clinicData,
              error: clinicData ? null : { message: "not found" },
            }),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: clinicData,
                error: clinicData ? null : { message: "not found" },
              }),
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: clinicData,
                  error: clinicData ? null : { message: "not found" },
                }),
              }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  it("resolves clinic from WABA phone number ID", async () => {
    const { resolveClinicFromWABA, invalidateWABACache } =
      await import("@/lib/whatsapp/waba-routing");
    invalidateWABACache();

    const client = createMockClient({
      id: "clinic-uuid-123",
      name: "Clinique Test",
      owner_phone: "+212600000000",
      address: "123 Rue Test",
      whatsapp_phone_number_id: "waba-phone-123",
    });

    const result = await resolveClinicFromWABA(client, "waba-phone-123");

    expect(result).not.toBeNull();
    expect(result!.clinicId).toBe("clinic-uuid-123");
    expect(result!.clinicName).toBe("Clinique Test");
  });

  it("returns null for unknown phone number ID", async () => {
    const { resolveClinicFromWABA, invalidateWABACache } =
      await import("@/lib/whatsapp/waba-routing");
    invalidateWABACache();

    const client = createMockClient(null);
    const result = await resolveClinicFromWABA(client, "unknown-phone");
    expect(result).toBeNull();
  });

  it("caches resolved routes", async () => {
    const { resolveClinicFromWABA, invalidateWABACache } =
      await import("@/lib/whatsapp/waba-routing");
    invalidateWABACache();

    const clinicData = {
      id: "clinic-cached",
      name: "Cached Clinic",
      owner_phone: null,
      address: null,
      whatsapp_phone_number_id: "cached-phone",
    };
    const client = createMockClient(clinicData);

    // First call hits DB
    const result1 = await resolveClinicFromWABA(client, "cached-phone");
    expect(result1!.clinicId).toBe("clinic-cached");

    // Second call hits cache
    const result2 = await resolveClinicFromWABA(client, "cached-phone");
    expect(result2!.clinicId).toBe("clinic-cached");

    // from() should only be called once (second call uses cache)
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("returns null for empty phone number ID", async () => {
    const { resolveClinicFromWABA, invalidateWABACache } =
      await import("@/lib/whatsapp/waba-routing");
    invalidateWABACache();

    const client = createMockClient(null);
    const result = await resolveClinicFromWABA(client, "");
    expect(result).toBeNull();
  });
});
