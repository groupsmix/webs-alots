/**
 * MFA server-action tests.
 *
 * Exercises the real enroll / verify / backup-code actions in `../mfa`
 * with the Supabase server client, audit log, and logger mocked. Covers
 * the unauthenticated guard, provider error mapping, the happy paths, and
 * backup-code hashing/consumption.
 */
import { createHash } from "crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { enrollMFA, verifyMFAEnrollment, generateBackupCodes, verifyBackupCode } from "../mfa";

const mocks = vi.hoisted(() => {
  const supabase = {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      mfa: { enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn() },
    },
  };
  return { supabase, logAuthEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn().mockResolvedValue(mocks.supabase),
}));
vi.mock("@/lib/audit-log", () => ({ logAuthEvent: mocks.logAuthEvent }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const USER = {
  id: "user-1",
  email: "doc@clinic.com",
  user_metadata: {} as Record<string, unknown>,
};

function sha256Code(code: string): string {
  return createHash("sha256").update(code.replaceAll("-", "").toUpperCase()).digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logAuthEvent.mockResolvedValue(undefined);
  mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.supabase.auth.updateUser.mockResolvedValue({ error: null });
});

describe("enrollMFA", () => {
  it("returns a generic error when unauthenticated", async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await enrollMFA()).toEqual({ data: null, error: "auth.genericError" });
  });

  it("maps a provider enrollment error", async () => {
    mocks.supabase.auth.mfa.enroll.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await enrollMFA()).toEqual({ data: null, error: "mfa.enrollError" });
  });

  it("returns the enrollment payload on success", async () => {
    mocks.supabase.auth.mfa.enroll.mockResolvedValue({
      data: { id: "factor-1", totp: { uri: "otpauth://x", secret: "SECRET", qr_code: "<svg/>" } },
      error: null,
    });
    expect(await enrollMFA()).toEqual({
      data: { factorId: "factor-1", totpUri: "otpauth://x", secret: "SECRET", qrCode: "<svg/>" },
      error: null,
    });
  });
});

describe("verifyMFAEnrollment", () => {
  it("maps a challenge error", async () => {
    mocks.supabase.auth.mfa.challenge.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await verifyMFAEnrollment("factor-1", "123456")).toEqual({ error: "mfa.verifyError" });
  });

  it("maps an invalid-code verify error", async () => {
    mocks.supabase.auth.mfa.challenge.mockResolvedValue({ data: { id: "chal-1" }, error: null });
    mocks.supabase.auth.mfa.verify.mockResolvedValue({ error: { message: "bad" } });
    expect(await verifyMFAEnrollment("factor-1", "000000")).toEqual({ error: "mfa.invalidCode" });
  });

  it("logs an audit event and succeeds on a valid code", async () => {
    mocks.supabase.auth.mfa.challenge.mockResolvedValue({ data: { id: "chal-1" }, error: null });
    mocks.supabase.auth.mfa.verify.mockResolvedValue({ error: null });
    expect(await verifyMFAEnrollment("factor-1", "123456")).toEqual({ error: null });
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mfa.enrolled", success: true }),
    );
  });
});

describe("generateBackupCodes", () => {
  it("returns a generic error when unauthenticated", async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await generateBackupCodes()).toEqual({ codes: null, error: "auth.genericError" });
  });

  it("generates 10 formatted codes and stores their hashes", async () => {
    const result = await generateBackupCodes();
    expect(result.error).toBeNull();
    expect(result.codes).toHaveLength(10);
    for (const code of result.codes!) expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);

    const stored = mocks.supabase.auth.updateUser.mock.calls[0][0].data
      .mfa_backup_codes as string[];
    expect(stored).toHaveLength(10);
    // Stored values are sha256 hashes (hex), never the plaintext codes.
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).toContain(sha256Code(result.codes![0]));
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mfa.backup_codes_generated" }),
    );
  });

  it("maps a storage failure", async () => {
    mocks.supabase.auth.updateUser.mockResolvedValue({ error: { message: "db down" } });
    expect(await generateBackupCodes()).toEqual({ codes: null, error: "mfa.backupCodeError" });
  });
});

describe("verifyBackupCode", () => {
  it("returns a generic error when unauthenticated", async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await verifyBackupCode("ABCD-1234")).toEqual({ error: "auth.genericError" });
  });

  it("errors when the user has no stored backup codes", async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { ...USER, user_metadata: {} } },
    });
    expect(await verifyBackupCode("ABCD-1234")).toEqual({ error: "mfa.noBackupCodes" });
  });

  it("rejects a code that does not match any stored hash", async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { ...USER, user_metadata: { mfa_backup_codes: [sha256Code("AAAA-BBBB")] } } },
    });
    expect(await verifyBackupCode("ZZZZ-9999")).toEqual({ error: "mfa.invalidBackupCode" });
  });

  it("consumes a matching code and persists the remaining hashes", async () => {
    const good = "ABCD-1234";
    const other = sha256Code("EEEE-FFFF");
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { ...USER, user_metadata: { mfa_backup_codes: [sha256Code(good), other] } } },
    });
    expect(await verifyBackupCode(good)).toEqual({ error: null });
    const remaining = mocks.supabase.auth.updateUser.mock.calls[0][0].data
      .mfa_backup_codes as string[];
    expect(remaining).toEqual([other]);
    expect(mocks.logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mfa.backup_code_used" }),
    );
  });
});
