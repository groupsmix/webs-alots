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

export const PROFILE_HEADER_NAMES = {
  id: HEADER_ID,
  role: HEADER_ROLE,
  clinic: HEADER_CLINIC,
  sig: HEADER_SIG,
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
 * Prefers `PROFILE_HEADER_HMAC_KEY` (R-02) but accepts `CRON_SECRET` as
 * a transitional fallback so existing deployments keep working until the
 * dedicated key is provisioned. Once `PROFILE_HEADER_HMAC_KEY` is set in
 * an environment, `CRON_SECRET` is no longer consulted for header HMAC.
 */
function getProfileHeaderSecret(): string | null {
  const dedicated = process.env.PROFILE_HEADER_HMAC_KEY;
  if (dedicated && dedicated.length > 0) return dedicated;
  const legacy = process.env.CRON_SECRET;
  if (legacy && legacy.length > 0) return legacy;
  return null;
}

function buildPayload(profile: SignedProfile): string {
  return `${profile.id}:${profile.role}:${profile.clinic_id ?? ""}`;
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
 * Sign a profile and return the hex-encoded signature, or `null` when
 * no HMAC key is configured. The caller must skip setting the
 * `x-auth-profile-*` headers when this returns `null`.
 */
export async function signProfileHeader(profile: SignedProfile): Promise<string | null> {
  const secret = getProfileHeaderSecret();
  if (!secret) return null;
  const key = await importHmacKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(buildPayload(profile)));
  return bytesToHex(new Uint8Array(sig));
}

export interface VerifyHeaderInput {
  id: string | null;
  role: string | null;
  clinic_id: string | null;
  signature: string | null;
}

/**
 * Verify the inbound `x-auth-profile-*` headers. Returns the parsed
 * profile on success, or `null` on any failure (missing fields, no
 * configured key, or signature mismatch). The caller MUST then perform
 * the authoritative DB lookup — `null` here means "do not trust the
 * headers", never "the user is anonymous".
 */
export async function verifyProfileHeader(input: VerifyHeaderInput): Promise<SignedProfile | null> {
  if (!input.id || !input.role || !input.signature) return null;
  const secret = getProfileHeaderSecret();
  if (!secret) return null;

  const key = await importHmacKey(secret, "sign");
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildPayload({ id: input.id, role: input.role, clinic_id: input.clinic_id })),
  );
  const expectedHex = bytesToHex(new Uint8Array(expected));

  if (!timingSafeHexEqual(expectedHex, input.signature)) return null;

  return { id: input.id, role: input.role, clinic_id: input.clinic_id };
}
