/**
 * Profile-header HMAC sign/verify helper.
 *
 * The middleware signs `(profile.id, role, clinic_id)` and forwards them
 * via `x-auth-profile-*` request headers so that `withAuth` can avoid a
 * second DB query. Those headers MUST NOT be trusted unless a valid HMAC
 * accompanies them — otherwise any caller could impersonate any user.
 *
 * Audit fixes:
 *   R-01: No hard-coded fallback. If the HMAC key is unset we refuse to
 *         sign and refuse to verify, forcing the authoritative DB lookup
 *         in `withAuth`. A forged header without a configured key is
 *         therefore inert.
 *   R-02: Uses a dedicated `PROFILE_HEADER_HMAC_KEY` distinct from
 *         `CRON_SECRET`, so a leak of one does not compromise the other.
 *         Falls back to `CRON_SECRET` only for backwards compatibility
 *         until operators have provisioned the new key.
 */

const HEADER_ID = "x-auth-profile-id";
const HEADER_ROLE = "x-auth-profile-role";
const HEADER_CLINIC = "x-auth-profile-clinic";
const HEADER_SIG = "x-auth-profile-sig";
const HEADER_IAT = "x-auth-profile-iat";

/**
 * C-02: Maximum age (in seconds) for a signed profile header to be considered
 * valid. After this window the signature is rejected and the authoritative DB
 * lookup is forced. 5 minutes is generous enough for clock skew between
 * middleware and route handler within the same Worker isolate.
 */
const MAX_HEADER_AGE_SECONDS = 300;

export const PROFILE_HEADER_NAMES = {
  id: HEADER_ID,
  role: HEADER_ROLE,
  clinic: HEADER_CLINIC,
  sig: HEADER_SIG,
  iat: HEADER_IAT,
} as const;

export interface SignedProfile {
  id: string;
  role: string;
  clinic_id: string | null;
}

/**
 * Returns the configured HMAC key for profile headers, or `null` when
 * none is set. Callers MUST treat `null` as "do not sign / do not trust
 * inbound headers" — never substitute a literal.
 *
 * S-05: The CRON_SECRET fallback has been removed. Leaking CRON_SECRET
 * must not also compromise session-header forgery. In production,
 * `PROFILE_HEADER_HMAC_KEY` is required (enforced by `enforceEnvValidation`).
 * In non-production, a missing key simply disables the optimization and
 * forces the authoritative DB lookup in `withAuth`.
 */
function getProfileHeaderSecret(): string | null {
  const dedicated = process.env.PROFILE_HEADER_HMAC_KEY;
  if (dedicated && dedicated.length > 0) return dedicated;
  // S-05: No CRON_SECRET fallback — the two secrets must be independent.
  return null;
}

function buildPayload(profile: SignedProfile, iat: number): string {
  return `${profile.id}:${profile.role}:${profile.clinic_id ?? ""}:${iat}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Constant-time hex string comparison. Avoids early-exit timing leaks
 * that `===` would introduce on attacker-controlled input.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function importHmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/**
 * Sign a profile and return the hex-encoded signature + issued-at timestamp,
 * or `null` when no HMAC key is configured. The caller must skip setting the
 * `x-auth-profile-*` headers when this returns `null`.
 *
 * C-02: The payload now includes an `iat` (issued-at) Unix timestamp so
 * that captured headers expire after MAX_HEADER_AGE_SECONDS. The caller
 * must set `x-auth-profile-iat` alongside the signature.
 */
export async function signProfileHeader(profile: SignedProfile): Promise<{ sig: string; iat: number } | null> {
  const secret = getProfileHeaderSecret();
  if (!secret) return null;
  const iat = Math.floor(Date.now() / 1000);
  const key = await importHmacKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(buildPayload(profile, iat)));
  return { sig: bytesToHex(new Uint8Array(sig)), iat };
}

export interface VerifyHeaderInput {
  id: string | null;
  role: string | null;
  clinic_id: string | null;
  signature: string | null;
  /** C-02: Unix timestamp (seconds) when the header was signed. */
  iat: string | null;
}

/**
 * Verify the inbound `x-auth-profile-*` headers. Returns the parsed
 * profile on success, or `null` on any failure (missing fields, no
 * configured key, signature mismatch, or expired `iat`).
 *
 * C-02: The signature now includes an `iat` timestamp. Headers older
 * than MAX_HEADER_AGE_SECONDS are rejected, preventing indefinite
 * replay of captured profile headers.
 *
 * The caller MUST then perform the authoritative DB lookup — `null`
 * here means "do not trust the headers", never "the user is anonymous".
 */
export async function verifyProfileHeader(input: VerifyHeaderInput): Promise<SignedProfile | null> {
  if (!input.id || !input.role || !input.signature) return null;

  // C-02: Require iat and reject expired headers
  const iat = input.iat ? parseInt(input.iat, 10) : NaN;
  if (isNaN(iat)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - iat) > MAX_HEADER_AGE_SECONDS) return null;

  const secret = getProfileHeaderSecret();
  if (!secret) return null;

  const key = await importHmacKey(secret, "sign");
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildPayload({ id: input.id, role: input.role, clinic_id: input.clinic_id }, iat)),
  );
  const expectedHex = bytesToHex(new Uint8Array(expected));

  if (!timingSafeHexEqual(expectedHex, input.signature)) return null;

  return { id: input.id, role: input.role, clinic_id: input.clinic_id };
}
