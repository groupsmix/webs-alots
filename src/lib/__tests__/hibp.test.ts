import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkBreachedPassword } from "../hibp";

describe("checkBreachedPassword", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns breached=false, checked=false when HIBP_CHECK_ENABLED=false", async () => {
    process.env.HIBP_CHECK_ENABLED = "false";
    const result = await checkBreachedPassword("password123");
    expect(result).toEqual({ breached: false, count: 0, checked: false });
  });

  it("returns breached=true when password is found in HIBP response", async () => {
    // SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix = 5BAA6, suffix = 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    const mockResponse = [
      "1D2DA4053E34E76F6576ED1FB87F4A3FAF9:1",
      "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493",
      "1F2B668E8AABEF1C59E9EC6F82E3F3CD786:2",
    ].join("\n");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await checkBreachedPassword("password");
    expect(result.breached).toBe(true);
    expect(result.count).toBe(3861493);
    expect(result.checked).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.pwnedpasswords.com/range/5BAA6",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Add-Padding": "true",
        }),
      }),
    );
  });

  it("returns breached=false when password is NOT found in HIBP response", async () => {
    const mockResponse = [
      "1D2DA4053E34E76F6576ED1FB87F4A3FAF9:1",
      "0000000000000000000000000000000000A:0",
    ].join("\n");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockResponse),
    }));

    const result = await checkBreachedPassword("my-super-unique-passphrase-xyz");
    expect(result.breached).toBe(false);
    expect(result.checked).toBe(true);
  });

  it("returns checked=false on network error (fail-open)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await checkBreachedPassword("password123");
    expect(result).toEqual({ breached: false, count: 0, checked: false });
  });

  it("returns checked=false on non-OK HTTP status (fail-open)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    const result = await checkBreachedPassword("password123");
    expect(result).toEqual({ breached: false, count: 0, checked: false });
  });

  it("is enabled by default (HIBP_CHECK_ENABLED not set)", async () => {
    delete process.env.HIBP_CHECK_ENABLED;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("0000000000000000000000000000000000A:0"),
    }));

    const result = await checkBreachedPassword("test");
    expect(result.checked).toBe(true);
  });
});
