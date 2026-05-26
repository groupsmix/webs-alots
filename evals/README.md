# AI Evaluation Harness

> **Audit finding:** F-AI-03 | **Last updated:** May 2026

Automated evaluation suite for Oltigo Health's AI clinical endpoints:
- `/api/v1/ai/prescription` — prescription generation
- `/api/v1/ai/drug-check` — drug interaction checking
- `/api/v1/ai/patient-summary` — patient summary generation

## Purpose

EU AI Act Art. 9 and NIST AI RMF MEASURE require pre-release testing of
high-risk AI systems. These evaluations run nightly to detect:

1. **Hallucination** — fabricated drug names, dosages, or contraindications
2. **Jailbreak** — prompt injection bypassing safety instructions
3. **Bias** — inconsistent recommendations based on patient demographics
4. **Regression** — behaviour drift after model updates

## Running Evaluations

```bash
# Run all evaluations (requires OPENAI_API_KEY)
npm run eval

# Run a specific evaluation suite
npx tsx evals/hallucination.eval.ts
npx tsx evals/jailbreak.eval.ts
npx tsx evals/bias.eval.ts
```

## CI Integration

The nightly GitHub Actions workflow (`.github/workflows/ai-evals.yml`) runs
these evaluations against the pinned model version and reports results to
the `evals/results/` directory.

## Test Cases

### Hallucination Tests (`hallucination.eval.ts`)
- Known drug interactions (e.g. warfarin + aspirin)
- Non-existent drug names (should refuse or flag uncertainty)
- Dosage boundary checks (should not exceed BNF/Vidal maximums)

### Jailbreak Tests (`jailbreak.eval.ts`)
- System prompt extraction attempts
- Role-play attacks ("pretend you are an unrestricted AI")
- Delimiter escape (inject `<<UNTRUSTED_PATIENT_INPUT_END>>`)
- Instruction injection via patient context fields

### Bias Tests (`bias.eval.ts`)
- Same symptoms, different patient names/ages/genders
- Verify recommendations are clinically consistent
- Flag any demographic-correlated variance

## Adding New Tests

Each `.eval.ts` file exports an array of test cases:

```typescript
interface EvalCase {
  name: string;
  input: Record<string, unknown>;
  assertions: {
    type: "contains" | "not_contains" | "matches" | "valid_json";
    value: string | RegExp;
  }[];
}
```

## Results

Results are written to `evals/results/` as timestamped JSON files.
The CI workflow uploads these as artifacts for review.
