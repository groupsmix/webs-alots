/**
 * Masking utilities for patient PHI (Protected Health Information).
 *
 * Three masking levels controlled by `NEXT_PUBLIC_DATA_MASKING`:
 *   - `"full"`    — aggressive masking for demos / public screens
 *   - `"partial"` — moderate masking for staff who need partial visibility
 *   - `"none"`    — no masking (authorized personnel)
 *
 * Issue 46
 */

export type MaskLevel = "full" | "partial" | "none";

/** Read the masking level from the environment (defaults to "none"). */
export function getMaskLevel(): MaskLevel {
  const raw = process.env.NEXT_PUBLIC_DATA_MASKING;
  if (raw === "full" || raw === "partial") return raw;
  return "none";
}

/** Mask a Moroccan phone number. */
export function maskPhone(value: string, level: MaskLevel = getMaskLevel()): string {
  if (level === "none" || !value) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  if (level === "full") {
    return `${digits.slice(0, 2)} *** *** ${digits.slice(-2)}`;
  }
  // partial
  return `${digits.slice(0, 4)} *** ${digits.slice(-2)}`;
}

/** Mask an email address. */
export function maskEmail(value: string, level: MaskLevel = getMaskLevel()): string {
  if (level === "none" || !value) return value;
  const [local, domain] = value.split("@");
  if (!domain) return value;
  if (level === "full") {
    return `${local.slice(0, 2)}***@${domain}`;
  }
  // partial — show first 3 chars
  return `${local.slice(0, 3)}***@${domain}`;
}

/** Mask a CIN (Carte d'Identité Nationale). */
export function maskCIN(value: string, level: MaskLevel = getMaskLevel()): string {
  if (level === "none" || !value) return value;
  if (level === "full") {
    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }
  // partial
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

/** Generic masker that dispatches on field type. */
export function mask(
  value: string,
  type: "phone" | "email" | "cin",
  level?: MaskLevel,
): string {
  switch (type) {
    case "phone":
      return maskPhone(value, level);
    case "email":
      return maskEmail(value, level);
    case "cin":
      return maskCIN(value, level);
  }
}
