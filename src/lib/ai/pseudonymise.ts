/**
 * F-AI-04: PHI pseudonymisation for AI prompts.
 *
 * Before sending patient context to OpenAI, replace real identifiers
 * (names, phone numbers, CIN, etc.) with deterministic pseudonyms.
 * The mapping is held in-memory for the duration of the request and
 * used to de-pseudonymise the response before returning to the caller.
 *
 * This ensures PHI is not transmitted to third-party AI providers while
 * maintaining clinical coherence in the prompt/response.
 */

/** Fields that contain PII/PHI and should be pseudonymised. */
const PHI_FIELDS = new Set([
  "name",
  "patient_name",
  "patientName",
  "full_name",
  "fullName",
  "first_name",
  "firstName",
  "last_name",
  "lastName",
  "email",
  "phone",
  "cin",
  "address",
  "insurance_number",
  "insuranceNumber",
]);

/** Deterministic placeholder names for consistency within a request. */
const PSEUDONYM_NAMES = [
  "Patient-A", "Patient-B", "Patient-C", "Patient-D",
  "Patient-E", "Patient-F", "Patient-G", "Patient-H",
];

export interface PseudonymMap {
  forward: Map<string, string>;
  reverse: Map<string, string>;
}

/**
 * Create a new pseudonym mapping context for a single request.
 */
export function createPseudonymMap(): PseudonymMap {
  return {
    forward: new Map(),
    reverse: new Map(),
  };
}

function getOrCreatePseudonym(
  map: PseudonymMap,
  field: string,
  value: string,
): string {
  const key = `${field}:${value}`;
  const existing = map.forward.get(key);
  if (existing) return existing;

  let pseudonym: string;
  if (field === "name" || field === "patient_name" || field === "patientName" ||
      field === "full_name" || field === "fullName" ||
      field === "first_name" || field === "firstName" ||
      field === "last_name" || field === "lastName") {
    pseudonym = PSEUDONYM_NAMES[map.forward.size % PSEUDONYM_NAMES.length] ?? `Patient-${map.forward.size}`;
  } else if (field === "phone") {
    // AI-004: Use random suffix instead of sequential counter to prevent
    // frequency-analysis reversal if pseudonymised transcripts are breached.
    const rnd = crypto.randomUUID().slice(0, 6);
    pseudonym = `+212-XXX-XXXX-${rnd}`;
  } else if (field === "email") {
    pseudonym = `patient-${crypto.randomUUID().slice(0, 6)}@redacted.local`;
  } else if (field === "cin") {
    pseudonym = `CIN-XXXXX-${crypto.randomUUID().slice(0, 6)}`;
  } else if (field === "address") {
    pseudonym = "[Address redacted]";
  } else if (field === "insurance_number" || field === "insuranceNumber") {
    pseudonym = `INS-XXXXX-${crypto.randomUUID().slice(0, 6)}`;
  } else {
    pseudonym = `[${field}-redacted]`;
  }

  map.forward.set(key, pseudonym);
  map.reverse.set(pseudonym, value);
  return pseudonym;
}

/**
 * Recursively pseudonymise PHI fields in an object.
 * Returns a deep copy with PHI fields replaced by pseudonyms.
 */
export function pseudonymise(
  obj: Record<string, unknown>,
  map: PseudonymMap,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (PHI_FIELDS.has(key) && typeof value === "string" && value.length > 0) {
      result[key] = getOrCreatePseudonym(map, key, value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? pseudonymise(item as Record<string, unknown>, map)
          : item,
      );
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = pseudonymise(value as Record<string, unknown>, map);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Replace pseudonyms back to real values in a response string.
 */
export function depseudonymise(text: string, map: PseudonymMap): string {
  let result = text;
  for (const [pseudonym, real] of map.reverse) {
    result = result.replaceAll(pseudonym, real);
  }
  return result;
}
