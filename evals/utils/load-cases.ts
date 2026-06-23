import fs from "fs";
import path from "path";

/**
 * Test-case loader with runtime schema validation.
 *
 * The runners previously did a bare `JSON.parse(...) as Type[]`, so malformed
 * cases (wrong enum values, missing fields, drifted `category`/`language`)
 * passed silently and were only "caught" by confusing downstream behaviour.
 * This loader validates every record against the field contract the runners
 * actually rely on and throws a precise error listing every offending case.
 */

export const CATEGORIES = [
  "jailbreak",
  "drug-interaction",
  "hallucination",
  "bias",
  "rag-groundedness",
] as const;

export const LANGUAGES = ["fr", "ar", "dr", "darija", "en"] as const;

export const OUTCOMES = ["refuse", "dangerous", "safe", "flagged", "grounded", "refused"] as const;

export const SEVERITIES = ["critical", "high", "medium", "low", "none"] as const;

type Category = (typeof CATEGORIES)[number];
type Language = (typeof LANGUAGES)[number];
type Outcome = (typeof OUTCOMES)[number];
type Severity = (typeof SEVERITIES)[number];

export interface StandardTestCase {
  id: string;
  category: Category;
  language: Language;
  input: string;
  context?: Record<string, unknown>;
  expected_outcome: Outcome;
  severity: Severity;
  description: string;
  /**
   * Optional ground-truth anchors (RAG grounded cases). When present, a
   * substantive answer MUST contain every listed substring (case-insensitive)
   * to be considered grounded — this is how grounding is verified
   * deterministically without an LLM judge.
   */
  expected_contains?: string[];
  /**
   * Optional negative anchors. The answer MUST NOT contain any of these
   * substrings (e.g. a fabricated dosage on a refusal case).
   */
  must_not_contain?: string[];
}

function readJsonArray(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array in ${path.basename(filePath)}`);
  }
  return parsed;
}

function isMember<T extends readonly string[]>(allowed: T, value: unknown): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Load and validate a standard (category/language/outcome) test-case file.
 * Throws with a complete list of problems if any record is malformed.
 */
export function loadStandardCases(filePath: string): StandardTestCase[] {
  const records = readJsonArray(filePath);
  const file = path.basename(filePath);
  const errors: string[] = [];
  const seenIds = new Set<string>();

  records.forEach((rec, index) => {
    const where = `${file}[${index}]`;
    if (typeof rec !== "object" || rec === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    const c = rec as Record<string, unknown>;
    const id = typeof c.id === "string" ? c.id : `<missing>`;

    if (typeof c.id !== "string" || c.id.length === 0) errors.push(`${where}: missing 'id'`);
    else if (seenIds.has(c.id)) errors.push(`${where}: duplicate id '${c.id}'`);
    else seenIds.add(c.id);

    if (!isMember(CATEGORIES, c.category))
      errors.push(`${where} (${id}): invalid category '${String(c.category)}'`);
    if (!isMember(LANGUAGES, c.language))
      errors.push(`${where} (${id}): invalid language '${String(c.language)}'`);
    if (typeof c.input !== "string" || c.input.length === 0)
      errors.push(`${where} (${id}): missing 'input'`);
    if (!isMember(OUTCOMES, c.expected_outcome))
      errors.push(`${where} (${id}): invalid expected_outcome '${String(c.expected_outcome)}'`);
    if (!isMember(SEVERITIES, c.severity))
      errors.push(`${where} (${id}): invalid severity '${String(c.severity)}'`);
    if (typeof c.description !== "string" || c.description.length === 0)
      errors.push(`${where} (${id}): missing 'description'`);

    if (c.expected_contains !== undefined && !isStringArray(c.expected_contains))
      errors.push(`${where} (${id}): 'expected_contains' must be an array of strings`);
    if (c.must_not_contain !== undefined && !isStringArray(c.must_not_contain))
      errors.push(`${where} (${id}): 'must_not_contain' must be an array of strings`);
  });

  if (errors.length > 0) {
    throw new Error(`Test-case validation failed for ${file}:\n  - ${errors.join("\n  - ")}`);
  }

  return records as StandardTestCase[];
}
