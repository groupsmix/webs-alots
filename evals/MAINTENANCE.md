# Test Case Maintenance Guide

The AI models and their safety filters evolve over time. To ensure the evaluation harness remains effective, the test cases must be maintained and updated periodically.

## When to Update Test Cases

1. **Model Upgrades:** When switching to a new foundation model (e.g., from GPT-4 to GPT-4o).
2. **New Attack Vectors:** When security researchers discover new prompt injection techniques.
3. **Medical Guideline Changes:** When treatments or drug interactions change in standard medical literature.

## How to Update Test Cases

1. Open the relevant JSON file in `evals/test-cases/`.
2. Add a new object conforming to the `evals/schemas/test-case.schema.json`.
3. Provide a clear, unique `id` and a descriptive `description` explaining the vector.

## Handling Model Updates

The deterministic offline suites (drug-interaction, triage, tool-loop) run with
no secrets or server. To additionally exercise the live RAG suite, run
`npm run eval:ai` locally with `EVAL_AUTH_TOKEN` set and `API_BASE_URL` pointed
at a tenant-resolvable, authenticated instance (see the README "Live RAG suite
prerequisites").
If the pass rate drops:

1. Examine `evals/results/` (per-suite JSON and the generated HTML report) to
   see which specific cases failed.
2. Determine if the model's safety has regressed, or if the model's new
   capability makes the previous expected outcome obsolete.
3. Update the `expected_outcome` if necessary, or fix the application's system
   prompt to handle the regression.

## Review Schedule

- **Monthly:** Review CI reports for slow degradation in pass rates.
- **Quarterly:** Add new red-flag triage phrases and drug pairs as guidelines
  evolve. (Jailbreak/bias suites are not yet implemented — see the README
  roadmap.)
