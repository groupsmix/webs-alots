/**
 * HIBP (Have I Been Pwned) k-anonymity password check — 6e / A154.
 *
 * Uses the Pwned Passwords Range API: only the first 5 characters of the
 * SHA-1 hash of the password are sent to the API (k-anonymity model).
 * The plaintext password never leaves the browser/server.
 *
 * @see https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const HIBP_API_URL = "https://api.pwnedpasswords.com/range";

/**
 * Check whether a password appears in the HIBP Pwned Passwords database.
 *
 * Returns the number of times the password has been seen in known data
 * breaches. A return value of 0 means the password was not found.
 * Throws on network error so callers can decide whether to block (fail-closed)
 * or warn (fail-open).
 *
 * @param password - The plaintext password to check (never transmitted).
 * @returns Number of times the password appears in breach datasets.
 */
export async function checkPasswordPwned(password: string): Promise<number> {
  // SHA-1 hash the password. We use SubtleCrypto (available in browser + edge)
  // rather than Node's `crypto` module for environment portability.
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(password));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  // k-anonymity: send only the first 5 characters of the hash.
  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);

  const response = await fetch(`${HIBP_API_URL}/${prefix}`, {
    // Tell HIBP to return results in the original hash format (not NTLM).
    headers: { "Add-Padding": "true" },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`HIBP API error: ${response.status}`);
  }

  const text = await response.text();

  // Response is a newline-separated list of "<SUFFIX>:<count>" pairs.
  for (const line of text.split("\n")) {
    const [hashSuffix, countStr] = line.trim().split(":");
    if (hashSuffix === suffix) {
      return parseInt(countStr ?? "0", 10);
    }
  }

  return 0;
}

/**
 * Validate that a password is not in the HIBP breach database.
 *
 * Returns `null` when the password is safe, or an error message string
 * when it appears in breaches. Returns `null` on network failure (fail-open)
 * to avoid blocking legitimate password resets during HIBP outages.
 *
 * @param password - The plaintext password to validate.
 */
export async function validatePasswordNotPwned(password: string): Promise<string | null> {
  try {
    const count = await checkPasswordPwned(password);
    if (count > 0) {
      return `This password has appeared in ${count.toLocaleString()} known data breach${count === 1 ? "" : "es"}. Please choose a different password.`;
    }
    return null;
  } catch {
    // Network error or HIBP unavailable — fail-open so users can still reset passwords.
    // The password policy (length/complexity) still applies regardless.
    return null;
  }
}
