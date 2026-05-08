import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../pagination";

describe("encodeCursor / decodeCursor (S-24 keyset pagination)", () => {
  it("round-trips a valid cursor", () => {
    const cursor = {
      appointment_date: "2026-04-15",
      start_time: "10:00:00",
      id: "00000000-0000-0000-0000-000000000001",
    };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("produces a URL-safe encoding (no '+', '/', or '=')", () => {
    // Use a payload that, in standard base64, would contain padding and
    // the URL-unsafe characters.
    const cursor = {
      appointment_date: "2026-04-15",
      start_time: "10:00:00",
      id: "????>>>><<<<",
    };
    const encoded = encodeCursor(cursor);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for a malformed cursor", () => {
    expect(decodeCursor("not-base64!@#")).toBeNull();
  });

  it("returns null for a base64 string that is not JSON", () => {
    expect(decodeCursor(Buffer.from("not json").toString("base64url"))).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const partial = Buffer.from(JSON.stringify({ appointment_date: "2026-04-15" })).toString(
      "base64url",
    );
    expect(decodeCursor(partial)).toBeNull();
  });

  it("rejects cursors that contain PostgREST filter delimiters", () => {
    // S-24: cursor values are interpolated into a PostgREST `or()` filter.
    // The decoder must reject `,`, `(`, `)` so a hostile cursor cannot
    // smuggle additional filters into the query.
    const malicious = Buffer.from(
      JSON.stringify({
        appointment_date: "2026-04-15",
        start_time: "10:00:00",
        id: "abc),or(clinic_id.eq.other",
      }),
    ).toString("base64url");
    expect(decodeCursor(malicious)).toBeNull();
  });
});
