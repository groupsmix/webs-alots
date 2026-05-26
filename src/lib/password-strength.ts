/**
 * F-A154-a: Password strength checking with HIBP integration.
 *
 * Client-side utility to check password quality before submission.
 * Uses the HIBP Passwords API v3 k-Anonymity endpoint.
 *
 * @see https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const HIBP_API_URL = "https://api.pwnedpasswords.com/range";

export interface PasswordCheckResult {
  /** Overall strength: strong, moderate, weak, compromised */
  strength: "strong" | "moderate" | "weak" | "compromised";
  /** Human-readable issues found */
  issues: string[];
  /** Number of times seen in data breaches (0 = not found, -1 = check failed) */
  breachCount: number;
}

/**
 * Check password against HIBP k-Anonymity API.
 * Returns the number of times it appeared in breaches, or -1 on error.
 */
async function checkHIBP(password: string): Promise<number> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`${HIBP_API_URL}/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) return -1;

    const text = await response.text();
    for (const line of text.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) return parseInt(count, 10) || 0;
    }

    return 0;
  } catch {
    return -1;
  }
}

/**
 * Comprehensive password strength check.
 * Validates minimum length, character classes, and HIBP breach status.
 */
export async function checkPasswordStrength(
  password: string,
): Promise<PasswordCheckResult> {
  const issues: string[] = [];

  if (password.length < 10) {
    issues.push("Le mot de passe doit contenir au moins 10 caractères");
  }
  if (!/[a-z]/.test(password)) {
    issues.push("Ajoutez au moins une lettre minuscule");
  }
  if (!/[A-Z]/.test(password)) {
    issues.push("Ajoutez au moins une lettre majuscule");
  }
  if (!/\d/.test(password)) {
    issues.push("Ajoutez au moins un chiffre");
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    issues.push("Ajoutez au moins un caractère spécial");
  }

  const breachCount = await checkHIBP(password);

  if (breachCount > 0) {
    issues.unshift(
      `Ce mot de passe a été trouvé ${breachCount.toLocaleString()} fois dans des fuites de données connues. Choisissez un autre mot de passe.`,
    );
    return { strength: "compromised", issues, breachCount };
  }

  if (issues.length === 0) {
    return { strength: "strong", issues: [], breachCount };
  }

  const strength = issues.length <= 1 ? "moderate" : "weak";
  return { strength, issues, breachCount };
}
