# AI Knowledge File Review Policy

> AUDIT P3-21: the static knowledge files under `src/lib/ai/knowledge/`
> feed clinical AI features. Stale interaction data is a clinical liability,
> so these files need a named owner and a recurring review.

## Files covered

| File                       | Used by                         | Risk if stale                |
| -------------------------- | ------------------------------- | ---------------------------- |
| `drug-interactions.csv`    | Drug interaction checks (CDSS)  | Missed dangerous interaction |
| `darija-medical-terms.csv` | Triage / chat language handling | Misunderstood symptoms       |
| `triage-taxonomy.csv`      | AI triage classification        | Wrong urgency classification |

## Policy

1. **Owner:** each file must have a clinically qualified owner (pharmacist or
   physician). Record the owner below.
2. **Cadence:** quarterly review, plus an immediate review when ANM/EMA/FDA
   safety communications affect listed molecules.
3. **Process:** the reviewer checks each row against a current reference
   (e.g. Thériaque, Vidal, ANSM alerts), updates rows, and bumps the
   `Last reviewed` date below in the same PR.
4. **Gate:** PRs touching these CSVs must update this file and pass the
   `drug-interaction` eval suite (`npm run eval:ai:drugs`).

## Review log

| File                       | Owner        | Last reviewed | Notes                      |
| -------------------------- | ------------ | ------------- | -------------------------- |
| `drug-interactions.csv`    | _unassigned_ | _never_       | Initial policy established |
| `darija-medical-terms.csv` | _unassigned_ | _never_       | Initial policy established |
| `triage-taxonomy.csv`      | _unassigned_ | _never_       | Initial policy established |
