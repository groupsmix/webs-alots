/**
 * Sanctioned-country blocking tests.
 *
 * Exercises the real `checkSanctionedCountry` from `../sanctioned-countries`
 * by attaching a Cloudflare-style `cf.country` to the request.
 */
import { describe, it, expect } from "vitest";
import { checkSanctionedCountry } from "../sanctioned-countries";

function requestFromCountry(country?: string): Request {
  const req = new Request("https://clinic.oltigo.com/api/foo");
  if (country !== undefined) {
    Object.assign(req, { cf: { country } });
  }
  return req;
}

describe("checkSanctionedCountry", () => {
  it("returns null when no geolocation data is present (local dev / non-CF)", () => {
    expect(checkSanctionedCountry(requestFromCountry())).toBeNull();
  });

  it("returns null for a non-sanctioned country", () => {
    expect(checkSanctionedCountry(requestFromCountry("MA"))).toBeNull();
    expect(checkSanctionedCountry(requestFromCountry("US"))).toBeNull();
  });

  it.each(["BY", "CU", "IR", "KP", "RU", "SY"])(
    "blocks sanctioned country %s with a 451",
    async (country) => {
      const result = checkSanctionedCountry(requestFromCountry(country));
      expect(result).not.toBeNull();
      expect(result?.status).toBe(451);
      const body = await result!.json();
      expect(body.code).toBe("REGION_BLOCKED");
      expect(body.ok).toBe(false);
    },
  );
});
