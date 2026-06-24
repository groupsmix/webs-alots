import fs from "fs";
import path from "path";

/**
 * Test-case loaders with runtime schema validation.
 *
 * The runners previously did a bare `JSON.parse(...) as Type[]`, so malformed
 * cases (wrong enum values, missing fields, duplicate ids, drifted
 * category/language) passed silently and only surfaced as confusing downstream
 * behaviour. These loaders validate every record against the field contract the
 * runners actually rely on and throw a precise error listing every offending
 * case, with the file name and index.
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
  expected_contains?: string[];
  must_not_contain?: string[];
}

export interface DrugInteractionTestCase extends StandardTestCase {
  context: { drug_a: string; drug_b: string };
  expected_outcome: "dangerous" | "flagged" | "safe";
}

export interface ToolLoopTestCase {
  id: string;
  description: string;
  role?: string;
  agentType?: string;
  expected_allowed?: boolean;
  test_type?: "config_check" | "tool_schema" | "readonly_check";
  expected_max_steps?: number;
  tool_name?: string;
  expect_required_rejects_empty?: boolean;
  description_detail?: string;
}

export interface TriageTestCase {
  id: string;
  input: string;
  expected_outcome: "urgent" | "high" | "normal" | "low";
  description: string;
  language: string;
  expected_tags: string[];
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

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function throwIfErrors(file: string, kind: string, errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(`${kind} validation failed for ${file}:\n  - ${errors.join("\n  - ")}`);
  }
}

/** Validate the shared id/description contract and flag duplicate ids. */
function checkIds(records: Record<string, unknown>[], file: string, errors: string[]): void {
  const seen = new Set<string>();
  records.forEach((c, i) => {
    const where = `${file}[${i}]`;
    if (!nonEmptyString(c.id)) errors.push(`${where}: missing 'id'`);
    else if (seen.has(c.id)) errors.push(`${where}: duplicate id '${c.id}'`);
    else seen.add(c.id);
  });
}

/**
 * Load and validate a standard (category/language/outcome) test-case file.
 * Throws with a complete list of problems if any record is malformed.
 */
export function loadStandardCases(filePath: string): StandardTestCase[] {
  const records = readJsonArray(filePath);
  const file = path.basename(filePath);
  const errors: string[] = [];

  records.forEach((rec, index) => {
    const where = `${file}[${index}]`;
    if (typeof rec !== "object" || rec === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    const c = rec as Record<string, unknown>;
    const id = nonEmptyString(c.id) ? c.id : "<missing>";

    if (!isMember(CATEGORIES, c.category))
      errors.push(`${where} (${id}): invalid category '${String(c.category)}'`);
    if (!isMember(LANGUAGES, c.language))
      errors.push(`${where} (${id}): invalid language '${String(c.language)}'`);
    if (!nonEmptyString(c.input)) errors.push(`${where} (${id}): missing 'input'`);
    if (!isMember(OUTCOMES, c.expected_outcome))
      errors.push(`${where} (${id}): invalid expected_outcome '${String(c.expected_outcome)}'`);
    if (!isMember(SEVERITIES, c.severity))
      errors.push(`${where} (${id}): invalid severity '${String(c.severity)}'`);
    if (!nonEmptyString(c.description)) errors.push(`${where} (${id}): missing 'description'`);
    if (c.expected_contains !== undefined && !isStringArray(c.expected_contains))
      errors.push(`${where} (${id}): 'expected_contains' must be an array of strings`);
    if (c.must_not_contain !== undefined && !isStringArray(c.must_not_contain))
      errors.push(`${where} (${id}): 'must_not_contain' must be an array of strings`);
  });

  checkIds(records as Record<string, unknown>[], file, errors);
  throwIfErrors(file, "Test-case", errors);
  return records as StandardTestCase[];
}

/**
 * RAG cases are standard cases additionally constrained to the two outcomes the
 * RAG runner can actually evaluate — this closes the "outcome enum footgun"
 * where a case authored with e.g. `"safe"` would load fine but never pass.
 */
export function loadRagCases(filePath: string): StandardTestCase[] {
  const cases = loadStandardCases(filePath);
  const file = path.basename(filePath);
  const errors: string[] = [];
  cases.forEach((c, i) => {
    if (c.category !== "rag-groundedness")
      errors.push(`${file}[${i}] (${c.id}): category must be 'rag-groundedness'`);
    if (c.expected_outcome !== "grounded" && c.expected_outcome !== "refused")
      errors.push(
        `${file}[${i}] (${c.id}): expected_outcome must be 'grounded' or 'refused' (got '${c.expected_outcome}')`,
      );
  });
  throwIfErrors(file, "RAG case", errors);
  return cases;
}

/** Drug-interaction cases additionally require a `{ drug_a, drug_b }` context. */
export function loadDrugInteractionCases(filePath: string): DrugInteractionTestCase[] {
  const cases = loadStandardCases(filePath);
  const file = path.basename(filePath);
  const errors: string[] = [];
  cases.forEach((c, i) => {
    if (c.category !== "drug-interaction")
      errors.push(`${file}[${i}] (${c.id}): category must be 'drug-interaction'`);
    if (!["dangerous", "flagged", "safe"].includes(c.expected_outcome))
      errors.push(
        `${file}[${i}] (${c.id}): expected_outcome must be dangerous|flagged|safe (got '${c.expected_outcome}')`,
      );
    const ctx = c.context as { drug_a?: unknown; drug_b?: unknown } | undefined;
    if (!ctx || !nonEmptyString(ctx.drug_a))
      errors.push(`${file}[${i}] (${c.id}): missing 'context.drug_a'`);
    if (!ctx || !nonEmptyString(ctx.drug_b))
      errors.push(`${file}[${i}] (${c.id}): missing 'context.drug_b'`);
  });
  throwIfErrors(file, "Drug-interaction", errors);
  return cases as DrugInteractionTestCase[];
}

/** Validate the tool-loop test shapes (RBAC / config_check / tool_schema / readonly_check). */
export function loadToolLoopCases(filePath: string): ToolLoopTestCase[] {
  const records = readJsonArray(filePath);
  const file = path.basename(filePath);
  const errors: string[] = [];

  records.forEach((rec, index) => {
    const where = `${file}[${index}]`;
    if (typeof rec !== "object" || rec === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    const c = rec as Record<string, unknown>;
    const id = nonEmptyString(c.id) ? c.id : "<missing>";
    if (!nonEmptyString(c.description)) errors.push(`${where} (${id}): missing 'description'`);

    const isRbac =
      nonEmptyString(c.role) &&
      nonEmptyString(c.agentType) &&
      typeof c.expected_allowed === "boolean";
    if (isRbac) {
      // ok
    } else if (c.test_type === "config_check") {
      if (c.expected_max_steps !== undefined && typeof c.expected_max_steps !== "number")
        errors.push(`${where} (${id}): 'expected_max_steps' must be a number`);
    } else if (c.test_type === "tool_schema") {
      if (!nonEmptyString(c.tool_name))
        errors.push(`${where} (${id}): tool_schema case requires 'tool_name'`);
      if (!nonEmptyString(c.agentType))
        errors.push(`${where} (${id}): tool_schema case requires 'agentType'`);
      if (typeof c.expect_required_rejects_empty !== "boolean")
        errors.push(
          `${where} (${id}): tool_schema case requires boolean 'expect_required_rejects_empty'`,
        );
    } else if (c.test_type === "readonly_check") {
      // ok
    } else {
      errors.push(
        `${where} (${id}): unrecognised case shape (need RBAC fields or a known test_type)`,
      );
    }
  });

  checkIds(records as Record<string, unknown>[], file, errors);
  throwIfErrors(file, "Tool-loop", errors);
  return records as ToolLoopTestCase[];
}

/** Validate the triage test shape (urgency outcome + tags). */
export function loadTriageCases(filePath: string): TriageTestCase[] {
  const records = readJsonArray(filePath);
  const file = path.basename(filePath);
  const errors: string[] = [];

  records.forEach((rec, index) => {
    const where = `${file}[${index}]`;
    if (typeof rec !== "object" || rec === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    const c = rec as Record<string, unknown>;
    const id = nonEmptyString(c.id) ? c.id : "<missing>";
    if (!nonEmptyString(c.input)) errors.push(`${where} (${id}): missing 'input'`);
    if (!["urgent", "high", "normal", "low"].includes(c.expected_outcome as string))
      errors.push(`${where} (${id}): invalid expected_outcome '${String(c.expected_outcome)}'`);
    if (!nonEmptyString(c.description)) errors.push(`${where} (${id}): missing 'description'`);
    if (c.expected_tags !== undefined && !isStringArray(c.expected_tags))
      errors.push(`${where} (${id}): 'expected_tags' must be an array of strings`);
  });

  checkIds(records as Record<string, unknown>[], file, errors);
  throwIfErrors(file, "Triage", errors);
  return records as TriageTestCase[];
}
