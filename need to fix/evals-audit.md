# Evals Directory — Full Audit Report

**Scope:** `c:\webs-alots\evals\`  
**Files audited:** 14 files (5 runners, 5 utilities, 4 test-case JSON files, 1 schema, 2 docs, 1 tsconfig)  
**Date:** 2026-07-02

---

## Severity Legend

| Label       | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| 🔴 Critical | Breaks correctness / patient-safety gate / exposes secrets         |
| 🟠 High     | Logic error that can silently pass bad test cases or wrong results |
| 🟡 Medium   | Real defect with a viable workaround; degrades reliability         |
| 🔵 Low      | Code-quality / maintenance issue with no immediate runtime impact  |

---

## 🔴 CRITICAL

---

### C-1 — `require.main === module` will NEVER be true in an ESM context

**File:** [`evals/utils/regression-detector.ts`](file:///c:/webs-alots/evals/utils/regression-detector.ts#L124)  
**Line:** 124

```ts
if (require.main === module) {   // ← dead code in ESM
```

**What's wrong:**  
The project runs `.ts` files with `tsx` under `moduleResolution: "bundler"` (ESM semantics).  
`require` and `require.main` are CommonJS globals that do not exist in ESM. When tsx transpiles with ESM output, `require.main` is `undefined`, so this block is permanently dead — the CLI mode of `regression-detector.ts` can never be triggered.  
Additionally, `tsx` v4 (the installed version `^4.22.3`) uses ESM loaders by default, making CJS module detection patterns unreliable.

**Why it's a problem:**  
Any developer who tries to run `npx tsx evals/utils/regression-detector.ts` directly (as a standalone regression check) will get a silently empty output with exit 0 instead of the expected baseline listing. The dead block also produces a TypeScript error when `@types/node` is properly configured for ESM (`moduleResolution: bundler` + `isolatedModules: true`): `require` may not be defined.

**Suggested fix:**

```ts
// Replace the CommonJS guard with an ESM-compatible check:
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) { ... }
```

Or simply remove the CLI mode and expose a separate entry script.

---

### C-2 — `__dirname` is unavailable in ESM — path resolution silently breaks at runtime

**Files:**

- [`evals/run-all.ts`](file:///c:/webs-alots/evals/run-all.ts#L27) — line 27
- [`evals/utils/regression-detector.ts`](file:///c:/webs-alots/evals/utils/regression-detector.ts#L40-L41) — lines 40–41
- [`evals/utils/results-io.ts`](file:///c:/webs-alots/evals/utils/results-io.ts#L22) — line 22
- [`evals/runners/drug-interaction-runner.ts`](file:///c:/webs-alots/evals/runners/drug-interaction-runner.ts#L51) — line 51
- [`evals/runners/triage-runner.ts`](file:///c:/webs-alots/evals/runners/triage-runner.ts#L42) — line 42
- [`evals/runners/tool-loop-runner.ts`](file:///c:/webs-alots/evals/runners/tool-loop-runner.ts#L132) — line 132
- [`evals/runners/rag-groundedness-runner.ts`](file:///c:/webs-alots/evals/runners/rag-groundedness-runner.ts#L266) — line 266

**What's wrong:**  
All seven files use `__dirname` which is a CommonJS global. Under Node.js ESM (which `tsx` v4 uses by default with the `--import tsx` flag in `run-all.ts`), `__dirname` is **not defined** and will throw `ReferenceError: __dirname is not defined` at runtime.

`tsx` provides a CJS shim when running files with `tsx <file>` directly (via `require` hooks), but the orchestrator (`run-all.ts`) launches children with `--import tsx` (ESM loader mode), which does NOT inject the CJS shim. This means child processes will crash with a `ReferenceError`.

**Why it's a problem:**  
Every path to test-case JSON files, the results directory, and the baselines directory is constructed using `__dirname`. When this throws, the runners output a fatal error and `run-all.ts` marks all suites as failed — a permanent CI blocker.

**Suggested fix:**  
Replace all `__dirname` usages with the ESM equivalent at the top of each file:

```ts
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

Or switch the `--import tsx` flag in `run-all.ts` back to the CJS hook (`--require tsx/cjs` or `tsx` invocation), which does inject `__dirname`. The simplest fix is to change the spawn call to use `tsx` as the runtime directly (same pattern as the `eval:ai` script in `package.json`):

```ts
// Instead of: spawn(process.execPath, ["--import", "tsx", scriptPath], ...)
// Use:
spawn("tsx", [scriptPath], { ...options, shell: false });
// or find tsx binary: spawn(require.resolve("tsx/dist/cli.mjs"), [scriptPath])
```

---

### C-3 — RAG runner with empty `EVAL_AUTH_TOKEN` still calls the API with a `"Bearer "` token — contradicts its own guard

**File:** [`evals/runners/rag-groundedness-runner.ts`](file:///c:/webs-alots/evals/runners/rag-groundedness-runner.ts#L88-L99)  
**Lines:** 88–99 (instance guard) vs. 246–256 (main guard)

**What's wrong:**  
`main()` at line 246 correctly early-exits when `EVAL_AUTH_TOKEN` is unset. But `RAGGroundednessRunner` is a public class — if someone instantiates it directly without going through `main()` (e.g. in a future integration test or if the class is re-used), `this.authToken` defaults to `""` and `runTestCase()` returns an error result with `skipped: false`. The comment on line 89 acknowledges this:

> "Guard: if the token is empty the runner was constructed without going through `main()`"

The guard correctly short-circuits, but it returns:

```ts
{ passed: false, actualOutcome: "error", ..., skipped: false }
```

This causes the case to count as a **failure** (not a skip), which will trip the 100% pass-rate gate and fail CI even when the intent is graceful skip.

**Why it's a problem:**  
If the suite is invoked standalone via `npx tsx evals/runners/rag-groundedness-runner.ts` with no token, `main()` catches it correctly. But the _class-level_ fallback path marks results as failed, not skipped — if used in any integration test context, it yields false negatives.

**Suggested fix:**  
Change the instance-level guard to set `skipped: true`:

```ts
return {
  testCase,
  passed: false, // still false — skipped cases are not "passed"
  actualOutcome: "skipped",
  modelResponse: "",
  executionTimeMs: 0,
  error: "EVAL_AUTH_TOKEN is not set — skipped.",
  skipped: true, // ← was false, should be true
};
```

---

## 🟠 HIGH

---

### H-1 — `drug-interaction-runner.ts`: `passRate` computed with division before checking zero total

**File:** [`evals/runners/drug-interaction-runner.ts`](file:///c:/webs-alots/evals/runners/drug-interaction-runner.ts#L98)  
**Line:** 98

```ts
const passRate = (passed / total) * 100;
```

**What's wrong:**  
If `testCases` is empty (e.g. JSON file exists but is empty, or `loadDrugInteractionCases` returns `[]`), `total` is `0` and this produces `NaN`. `NaN` propagates into `writeSuiteResult`, `checkRegression`, and the console output. `checkRegression` at line 70 has a `currentTotal === 0` guard that would catch this, but the `NaN` passRate is written to disk first and `passRate.toFixed(1)` at line 102 will also output `"NaN%"`.

Contrast this with `base-runner.ts` line 111 which correctly guards: `/ (total || 1)`.

**Why it's a problem:**  
`NaN` in the results JSON will corrupt the aggregate report's pass-rate math in `run-all.ts` (line 83: `(passed / total) * 100` — same vulnerability at the aggregate level).

**Suggested fix:**

```ts
const passRate = total > 0 ? (passed / total) * 100 : 0;
```

---

### H-2 — `triage-runner.ts`: same `NaN` on zero total

**File:** [`evals/runners/triage-runner.ts`](file:///c:/webs-alots/evals/runners/triage-runner.ts#L93)  
**Line:** 93

```ts
const passRate = (passed / total) * 100;
```

Same root cause as H-1. No zero-guard.

**Suggested fix:** same pattern — `total > 0 ? (passed / total) * 100 : 0`.

---

### H-3 — `tool-loop-runner.ts`: same `NaN` on zero total

**File:** [`evals/runners/tool-loop-runner.ts`](file:///c:/webs-alots/evals/runners/tool-loop-runner.ts#L173)  
**Line:** 173

```ts
const passRate = (passed / total) * 100;
```

Same root cause as H-1 and H-2.

**Suggested fix:** same pattern.

---

### H-4 — `run-all.ts`: aggregate `passRate` is also NaN-vulnerable on zero total

**File:** [`evals/run-all.ts`](file:///c:/webs-alots/evals/run-all.ts#L83)  
**Line:** 83

```ts
passRate: total > 0 ? (passed / total) * 100 : 100,
```

**What's wrong:**  
This one has the zero guard, but it defaults to `100` (pass) when zero cases run. This means if _all_ suites are skipped or produce empty results, the aggregate reports `100%` and Slack receives no alert, even though nothing was actually tested. This is a silent false-green.

**Why it's a problem:**  
A completely broken eval environment (e.g. all JSON files missing) would report as `100% pass / 0 cases` — indistinguishable from a genuine full pass.

**Suggested fix:**  
Fail (or at minimum alert) when `total === 0`:

```ts
passRate: total > 0 ? (passed / total) * 100 : 0,
```

And add an explicit check in `runAll()`:

```ts
if (total === 0) {
  console.error("🚨 No test cases evaluated — check runner output above.");
  process.exit(1);
}
```

---

### H-5 — `regression-detector.ts`: baseline update only triggers on improvement — stale baselines never decay

**File:** [`evals/utils/regression-detector.ts`](file:///c:/webs-alots/evals/utils/regression-detector.ts#L112-L118)  
**Lines:** 112–118

```ts
if (currentPassRate > existing.passRate) {
  existing.passRate = currentPassRate;
  ...
}
```

**What's wrong:**  
The baseline is only bumped when pass rate **increases**. A permanently-stuck-at-100% suite will never update `total` unless it also changes `passRate`. If the test suite shrinks (cases removed) but pass rate stays 100%, the stale `total` in the baseline doesn't reflect the new reality — the `maxDropPct` check operates on rate only, so count regressions (fewer tests) are invisible.

**Why it's a problem:**  
Someone could accidentally delete half the drug-interaction test cases, the suite would still report 100% pass rate, and the regression detector would consider this a "pass" without any warning.

**Suggested fix:**  
Always update the baseline's `total` even when rate is unchanged:

```ts
if (currentPassRate > existing.passRate || currentTotal !== existing.total) {
  existing.passRate = Math.max(currentPassRate, existing.passRate);
  existing.total = currentTotal;
  existing.updatedAt = new Date().toISOString();
  saveBaselines(baselines);
}
```

---

### H-6 — `loadTriageCases`: `id` is validated only by `checkIds` (called after the loop) — `id` can be `<missing>` in error messages

**File:** [`evals/utils/load-cases.ts`](file:///c:/webs-alots/evals/utils/load-cases.ts#L274-L298)  
**Lines:** 274–298

**What's wrong:**  
`loadTriageCases` uses `checkIds` for id deduplication (line 295) but does NOT validate that `c.id` is non-empty within the `forEach` loop (contrast with `loadStandardCases` at line 118 which checks `c.id` inline). The fallback `<missing>` label appears in error messages — acceptable — but means a triage record with `id: ""` or no `id` field passes the inline loop and is only caught by `checkIds`. Unlike `loadStandardCases`, there's no explicit `if (!nonEmptyString(c.id)) errors.push(...)` inline.

Additionally, `loadTriageCases` does not validate that `c.language` is one of the allowed values (`fr|ar|darija|en`), even though `TriageTestCase` includes a `language: string` field. This means an incorrectly-authored triage case (e.g. `"language": "spanish"`) loads without error.

**Suggested fix:**  
Add inline `id` and `language` validation to `loadTriageCases`:

```ts
if (!nonEmptyString(c.id)) errors.push(`${where}: missing or empty 'id'`);
if (!isMember(LANGUAGES, c.language))
  errors.push(`${where} (${id}): invalid language '${String(c.language)}'`);
```

---

### H-7 — `alerter.ts`: Slack alert failure is silently swallowed — no exit code change

**File:** [`evals/utils/alerter.ts`](file:///c:/webs-alots/evals/utils/alerter.ts#L36-L38)  
**Lines:** 36–38

```ts
} catch (err) {
  console.error("Failed to send Slack alert:", err);
}
```

**What's wrong:**  
A network failure sending the Slack alert is caught and logged, but the promise resolves normally. `run-all.ts` calls `await alertOnFailure(summary)` (line 91) and then checks `allPassed` to decide the exit code. If Slack delivery fails, there is no indication in the exit code and the operator has no automated way to know the failure notification was dropped.

**Why it's a problem:**  
In a CI scenario where the Slack alert is the only failure notification mechanism, a silent swallow means on-call gets no page.

**Suggested fix:**  
Either re-throw after logging (letting `run-all.ts` handle it), or return a boolean indicating send success so the caller can decide.

---

## 🟡 MEDIUM

---

### M-1 — `base-runner.ts` `generateReport()`: skipped cases are excluded from metrics but their failures still appear in the Failures section

**File:** [`evals/runners/base-runner.ts`](file:///c:/webs-alots/evals/runners/base-runner.ts#L163-L170)  
**Lines:** 163–170

```ts
this.results
  .filter((r) => !r.passed)
  .forEach(...)
```

**What's wrong:**  
`generateReport()` lists all `!r.passed` results including skipped ones. But skipped cases are excluded from `total`/`passed`/`failed` in `calculateMetrics()`. This inconsistency means the "Failures" section of the text report can list cases not counted in the summary numbers — a confusing mismatch for operators debugging a partial skip.

**Suggested fix:**  
Add `&& !r.skipped` to the filter:

```ts
this.results.filter((r) => !r.passed && !r.skipped).forEach(...)
```

---

### M-2 — `rag-groundedness-runner.ts`: `stripDisclaimer` is brittle — exact suffix match will silently stop working if disclaimer changes

**File:** [`evals/runners/rag-groundedness-runner.ts`](file:///c:/webs-alots/evals/runners/rag-groundedness-runner.ts#L18-L22)  
**Lines:** 18–22

**What's wrong:**  
The disclaimer is stripped via an exact suffix match (`fullText.endsWith(APPENDED_DISCLAIMER)`). If the streaming chat implementation changes even one character of the appended disclaimer — a trailing space, a locale change, a new paragraph — the strip silently fails. Every response then looks "answered" because the disclaimer itself contains non-empty text, defeating the empty-non-answer check for anchorless grounded cases.

**Why it's a problem:**  
This is a silent correctness regression: the runner will still run and report results, but grounded cases without `expected_contains` anchors will always pass (the disclaimer makes every response non-empty), even when the actual substantive answer is missing.

**Suggested fix:**  
Add a regex-based strip that matches `\n\n---\n<any text>$` as a fallback:

```ts
function stripDisclaimer(fullText: string): string {
  if (fullText.endsWith(APPENDED_DISCLAIMER)) return fullText.slice(0, -APPENDED_DISCLAIMER.length);
  // Fallback: strip any trailing HR + block
  return fullText.replace(/\n\n---\n[\s\S]*$/, "");
}
```

---

### M-3 — `results-io.ts`: `clearSuiteResults()` deletes HTML reports inside `results/` including reports from the current run if called mid-run

**File:** [`evals/utils/results-io.ts`](file:///c:/webs-alots/evals/utils/results-io.ts#L52-L57)  
**Lines:** 52–57

**What's wrong:**  
`clearSuiteResults()` deletes all `.json` and `.html` files from `results/`. It is called at the top of `runAll()` (before suites run), which is correct. However, the function deletes HTML files too. If a developer calls `clearSuiteResults()` at any other point — or if the function is ever moved later in the flow — it could delete HTML reports that were just written by `generateHtmlReport()`. There is no timestamp or uniqueness guard.

**Suggested fix:**  
Limit deletion scope to known suite JSON files (`drug-interaction.json`, `triage.json`, etc.), not a blanket glob:

```ts
const KNOWN_SUITE_FILES = [
  "drug-interaction.json",
  "triage.json",
  "tool-loop.json",
  "rag-groundedness.json",
];
for (const f of KNOWN_SUITE_FILES) {
  const p = path.join(resultsDir, f);
  if (fs.existsSync(p)) fs.rmSync(p);
}
```

---

### M-4 — `regression-detector.ts` also exports a `resultsDir` that duplicates `results-io.ts`'s `resultsDir`

**Files:**

- [`evals/utils/regression-detector.ts`](file:///c:/webs-alots/evals/utils/regression-detector.ts#L41) — line 41
- [`evals/utils/results-io.ts`](file:///c:/webs-alots/evals/utils/results-io.ts#L22) — line 22

**What's wrong:**  
Both files define `resultsDir = path.join(__dirname, "../results")` independently. `run-all.ts` imports `resultsDir` from `results-io`, but `regression-detector.ts` has its own private copy. If the results path ever changes, it must be updated in two places.

**Suggested fix:**  
Remove the private `resultsDir` in `regression-detector.ts` and import it from `results-io`:

```ts
import { resultsDir } from "./results-io";
```

---

### M-5 — `rag-groundedness.json`: `expected_contains` anchor `"300"` is too broad — will false-match unrelated numbers

**File:** [`evals/test-cases/rag-groundedness.json`](file:///c:/webs-alots/evals/test-cases/rag-groundedness.json#L19)  
**Lines:** 19, 57, 67

```json
"expected_contains": ["300"]
```

**What's wrong:**  
The anchor `"300"` matches any occurrence of the substring "300" anywhere in the response — including "300 patients", "3000 words", "since 2300 BC", etc. The README explicitly warns:

> "Prefer precise tokens like `"500 mg"` over a bare `"mg"`, which would false-match unrelated words."

Three cases (`rag-02`, `rag-06`, `rag-07`) use the bare `"300"` anchor for pricing.

**Why it's a problem:**  
The anchor is intended to verify "300 MAD" appears. A hallucinated response containing any other "300" (e.g. "We serve 300 patients") would incorrectly pass.

**Suggested fix:**  
Use the currency-disambiguated form: `"300 MAD"` or `"300 DH"` or `"300 dirhams"` — whatever the seeded Test Clinic fixture actually returns.

---

### M-6 — `rag-groundedness.json`: `expected_contains: ["22 33 44 55"]` (rag-13) looks like a placeholder phone number

**File:** [`evals/test-cases/rag-groundedness.json`](file:///c:/webs-alots/evals/test-cases/rag-groundedness.json#L122)  
**Line:** 122

**What's wrong:**  
The phone anchor `"22 33 44 55"` has a sequential pattern strongly suggesting it is a seed/placeholder value rather than the real Test Clinic fixture phone number. Per the README: "Populate these anchors with values from the seeded 'Test Clinic' dataset (e.g. the real phone number)."

**Why it's a problem:**  
If the seeded Test Clinic's phone number is different, this anchor will never match any real response, causing `rag-13` to always fail with `hallucinated` — a permanent, misleading CI failure.

**Suggested fix:**  
Verify the exact phone number stored in the Test Clinic fixture (likely in `supabase/migrations/` or a seed script) and update the anchor to match.

---

### M-7 — `rag-groundedness.json` rag-03: `expected_contains: ["Benali"]` is a specific doctor name with no fixture verification

**File:** [`evals/test-cases/rag-groundedness.json`](file:///c:/webs-alots/evals/test-cases/rag-groundedness.json#L29)  
**Line:** 29

**What's wrong:**  
Anchoring on doctor name `"Benali"` is valid if that name is seeded in the Test Clinic fixture. But unlike hours/price/location, doctor names can change when fixtures are updated. There is no cross-reference to the actual seed data.

**Suggested fix:**  
Add a comment or linked reference to the seed script that defines the Test Clinic doctors. Consider querying `supabase/migrations/` to confirm `Benali` exists.

---

### M-8 — `tool-loop-runner.ts`: synchronous `runToolLoopEval()` wraps async calls but is not declared `async`

**File:** [`evals/runners/tool-loop-runner.ts`](file:///c:/webs-alots/evals/runners/tool-loop-runner.ts#L131)  
**Line:** 131

**What's wrong:**  
`runToolLoopEval()` is declared as a plain synchronous function. Inside it calls `checkToolSchema()` which calls `buildSDKTools()` — these may be synchronous today, but the function is wrapped in a `try/catch` (line 195) that does not handle unhandled promise rejections. If any called function ever returns a Promise (e.g. `getAgentTools` becomes async), the rejection would be uncaught and Node would print an unhandled rejection warning without failing the suite via `process.exit(1)`.

**Suggested fix:**  
Make `runToolLoopEval` async and await it properly:

```ts
async function runToolLoopEval() { ... }
runToolLoopEval().catch((err) => {
  console.error("Fatal evaluation error:", err);
  process.exit(1);
});
```

This matches the pattern used by all other runners.

---

## 🔵 LOW

---

### L-1 — `evals/tsconfig.json`: comment inside `//` key uses deprecated terminology ("no baseUrl — deprecated in TS 7.0")

**File:** [`evals/tsconfig.json`](file:///c:/webs-alots/evals/tsconfig.json#L2)  
**Line:** 2

**What's wrong:**  
The comment mentions "deprecated in TS 7.0" — TypeScript is not yet at version 7.0 (current stable is 5.x). This is either a forward-dated comment (premature) or a copy-paste from a spec/proposal. It is confusing for contributors who look up `baseUrl` and find it is not deprecated in the current TS version.

**Suggested fix:**  
Update the comment to accurately reflect current TypeScript docs: `baseUrl` is discouraged when using `paths` alone (TS 5.x), but not formally deprecated.

---

### L-2 — `base-runner.ts`: `/* eslint-disable @typescript-eslint/no-explicit-any */` blanket suppression

**File:** [`evals/runners/base-runner.ts`](file:///c:/webs-alots/evals/runners/base-runner.ts#L1)  
**Line:** 1

**What's wrong:**  
A file-level ESLint disable for `no-explicit-any` suppresses the rule for the entire file. The actual `any` usage is limited to `context?: Record<string, any>` in the `TestCase` interface (line 17). This is reasonable but the blanket disable could mask future accidental `any` additions.

**Suggested fix:**  
Use an inline suppression only on the specific line:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
context?: Record<string, any>;
```

---

### L-3 — `rag-groundedness-runner.ts`: same blanket `eslint-disable` for `any`

**File:** [`evals/runners/rag-groundedness-runner.ts`](file:///c:/webs-alots/evals/runners/rag-groundedness-runner.ts#L1)  
**Line:** 1

Same issue as L-2. The `any` is used only at line 117: `(data as any).error`. Apply the suppression inline.

---

### L-4 — `base-runner.ts`: `logProgress()` does not log skipped cases — silent omission in output

**File:** [`evals/runners/base-runner.ts`](file:///c:/webs-alots/evals/runners/base-runner.ts#L140-L145)  
**Lines:** 140–145

**What's wrong:**  
`logProgress()` uses `result.passed ? "✅ PASS" : "❌ FAIL"` — skipped results are logged as `❌ FAIL` because `passed` is `false` for skipped cases. This makes the console output misleading: a skipped RAG case appears as a failure during the run, even though it is correctly excluded from metrics.

**Suggested fix:**

```ts
const status = result.skipped ? "⏭️ SKIP" : result.passed ? "✅ PASS" : "❌ FAIL";
```

---

### L-5 — `schemas/test-case.schema.json`: schema does not list `"triage"` as a category — triage test cases have no schema

**File:** [`evals/schemas/test-case.schema.json`](file:///c:/webs-alots/evals/schemas/test-case.schema.json)

**What's wrong:**  
The JSON schema `category` enum is: `["jailbreak", "drug-interaction", "hallucination", "bias", "rag-groundedness"]`. There is no `"triage"` category. The triage test cases (`triage.json`) use a different shape (no `category` field, no `severity` field, only `urgent|non-urgent` outcomes) — they are intentionally not validated by the standard schema loader. However, the schema file itself has no counterpart for triage, meaning IDE schema-validation (e.g. VS Code `$schema` linking) cannot validate `triage.json`.

**Suggested fix:**  
Add a separate `triage-test-case.schema.json` or document clearly in `MAINTENANCE.md` that triage cases follow the `TriageTestCase` interface, not the standard schema.

---

### L-6 — Dead `category` values in schema (`"jailbreak"`, `"hallucination"`, `"bias"`) with no runners

**File:** [`evals/schemas/test-case.schema.json`](file:///c:/webs-alots/evals/schemas/test-case.schema.json#L12)  
**Line:** 12

**What's wrong:**  
The schema and the `CATEGORIES` constant in `load-cases.ts` include `"jailbreak"`, `"hallucination"`, and `"bias"`. No test-case JSON files and no runners exist for these categories. The README acknowledges they are "not yet implemented." A test case accidentally authored with `"category": "jailbreak"` would pass schema validation and load validation, but would be silently unused.

**Why it's a problem:**  
Low risk, but a contributor adding a jailbreak case gets no feedback that no runner will ever execute it.

**Suggested fix:**  
Until the runners exist, consider marking these categories as `"x-reserved"` in a schema comment, or adding a `loadStandardCases` check that warns when a loaded case's category has no corresponding runner.

---

### L-7 — `alerter.ts`: non-Slack HTTPS webhook hostname only logs a `console.warn` — not an error

**File:** [`evals/utils/alerter.ts`](file:///c:/webs-alots/evals/utils/alerter.ts#L24-L28)  
**Lines:** 24–28

**What's wrong:**  
If `SLACK_WEBHOOK_URL` points to a non-Slack HTTPS host, the code logs `console.warn` but **still sends the POST**. This means eval failure data (case counts, pass rates, suite names) can be exfiltrated to an arbitrary HTTPS endpoint. The comment on lines 9–11 says this is guarded — but it only validates the URL scheme, not the destination.

**Why it's a problem:**  
A misconfigured or compromised environment variable would silently send eval metadata to a third-party server.

**Suggested fix:**  
Either treat non-Slack hostnames as errors (return without posting), or make the host allowlist enforcement stricter:

```ts
if (parsedUrl.hostname !== "hooks.slack.com" && !parsedUrl.hostname.endsWith(".slack.com")) {
  console.error("SLACK_WEBHOOK_URL does not point to a known Slack host — aborting alert.");
  return; // ← was a warn + continue, should be a return
}
```

---

## Summary Table

| ID  | File                                    | Line(s)                         | Severity    | Category      |
| --- | --------------------------------------- | ------------------------------- | ----------- | ------------- |
| C-1 | `utils/regression-detector.ts`          | 124                             | 🔴 Critical | Bug/Runtime   |
| C-2 | `run-all.ts`, all runners, `utils/*.ts` | 27, 40–41, 22, 51, 42, 132, 266 | 🔴 Critical | Bug/Blocker   |
| C-3 | `runners/rag-groundedness-runner.ts`    | 88–99                           | 🔴 Critical | Logic Error   |
| H-1 | `runners/drug-interaction-runner.ts`    | 98                              | 🟠 High     | Bug           |
| H-2 | `runners/triage-runner.ts`              | 93                              | 🟠 High     | Bug           |
| H-3 | `runners/tool-loop-runner.ts`           | 173                             | 🟠 High     | Bug           |
| H-4 | `run-all.ts`                            | 83                              | 🟠 High     | Logic Error   |
| H-5 | `utils/regression-detector.ts`          | 112–118                         | 🟠 High     | Logic Error   |
| H-6 | `utils/load-cases.ts`                   | 274–298                         | 🟠 High     | Bug           |
| H-7 | `utils/alerter.ts`                      | 36–38                           | 🟠 High     | Reliability   |
| M-1 | `runners/base-runner.ts`                | 163–170                         | 🟡 Medium   | Logic Error   |
| M-2 | `runners/rag-groundedness-runner.ts`    | 18–22                           | 🟡 Medium   | Fragility     |
| M-3 | `utils/results-io.ts`                   | 52–57                           | 🟡 Medium   | Logic Error   |
| M-4 | `utils/regression-detector.ts`          | 41                              | 🟡 Medium   | Duplication   |
| M-5 | `test-cases/rag-groundedness.json`      | 19, 57, 67                      | 🟡 Medium   | Test Quality  |
| M-6 | `test-cases/rag-groundedness.json`      | 122                             | 🟡 Medium   | Test Quality  |
| M-7 | `test-cases/rag-groundedness.json`      | 29                              | 🟡 Medium   | Test Quality  |
| M-8 | `runners/tool-loop-runner.ts`           | 131                             | 🟡 Medium   | Async Safety  |
| L-1 | `evals/tsconfig.json`                   | 2                               | 🔵 Low      | Documentation |
| L-2 | `runners/base-runner.ts`                | 1                               | 🔵 Low      | Code Quality  |
| L-3 | `runners/rag-groundedness-runner.ts`    | 1                               | 🔵 Low      | Code Quality  |
| L-4 | `runners/base-runner.ts`                | 140–145                         | 🔵 Low      | UX/Output     |
| L-5 | `schemas/test-case.schema.json`         | —                               | 🔵 Low      | Documentation |
| L-6 | `schemas/test-case.schema.json`         | 12                              | 🔵 Low      | Dead Code     |
| L-7 | `utils/alerter.ts`                      | 24–28                           | 🔵 Low      | Security      |

**Total: 3 Critical · 7 High · 8 Medium · 7 Low = 25 findings**

---

## Top Priority Fix Order

1. **C-2 first** — `__dirname` + `--import tsx` ESM mismatch is an outright CI blocker. Nothing runs without fixing this.
2. **C-1** — `require.main` dead code means the standalone regression-detector CLI is permanently broken.
3. **C-3** — Skipped vs. failed classification in the RAG runner guards correctness of the 100% threshold.
4. **H-1/H-2/H-3/H-4** — NaN propagation in pass-rate math corrupts reports and regression logic.
5. **H-6** — Triage loader missing `id` and `language` validation allows silently malformed test cases.
6. **L-7** — Alerter SSRF-adjacent: sends data to arbitrary HTTPS hosts on misconfiguration.
