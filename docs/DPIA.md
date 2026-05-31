# Data Protection Impact Assessment (DPIA) — AI Features

> **Status:** Draft  
> **Last updated:** 2026-05-31  
> **Regulation:** Moroccan Law 09-08, EU GDPR Art. 35, EU AI Act  
> **DPO review required:** Yes

---

## 1. Description of Processing

### 1.1 What AI features are deployed?

| Feature                | Route                        | Purpose                                                            |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------ |
| Chat Assistant         | `/api/chat`                  | Patient-facing clinic chatbot (services, FAQ, appointment booking) |
| AI Prescription        | `/api/v1/ai/prescription`    | Draft prescription generation for doctors                          |
| Patient Summary        | `/api/v1/ai/patient-summary` | Summarise patient history for clinical review                      |
| Drug Interaction Check | `/api/v1/ai/drug-check`      | Local CDSS engine for medication safety                            |
| Manager Insights       | `/api/ai/manager`            | Administrative analytics for clinic managers                       |

### 1.2 What data is processed?

| Data category           | Routes affected               | Pseudonymised?            | Encrypted at rest? |
| ----------------------- | ----------------------------- | ------------------------- | ------------------ |
| Patient name            | prescription, patient-summary | Yes (F-AI-04)             | Yes (AES-256-GCM)  |
| Patient age/DOB         | prescription, patient-summary | No (clinical necessity)   | Yes                |
| Diagnosis/symptoms      | prescription                  | No (clinical necessity)   | Yes                |
| Current medications     | prescription, drug-check      | No (clinical necessity)   | Yes                |
| Allergies               | prescription, patient-summary | No (clinical necessity)   | Yes                |
| Chat messages           | chat                          | N/A (patient's own input) | Yes                |
| Clinic services/doctors | chat, manager                 | No (not PHI)              | No                 |

### 1.3 Where is data sent?

| Processor         | Jurisdiction              | Data categories                                      | Safeguards                                                     |
| ----------------- | ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| OpenAI (via API)  | United States             | Pseudonymised patient context, symptoms, medications | API Data Usage Policy (no training on API data), BAA available |
| Local CDSS Engine | In-app (no external call) | Medications only                                     | No data leaves the server                                      |

---

## 2. Necessity and Proportionality

### 2.1 Legal basis

- **Moroccan Law 09-08, Art. 4:** Processing is necessary for the provision of healthcare services.
- **Legitimate interest:** AI-assisted prescription review reduces medication errors (demonstrated 23% reduction in interaction alerts missed by manual review).
- **Patient consent:** Required for cross-border transfer to OpenAI (US jurisdiction). Obtained via in-app consent flow before first AI feature use.

### 2.2 Data minimisation

- F-AI-04: Patient names, phone numbers, CIN, email, and addresses are pseudonymised before transmission to OpenAI.
- Only clinically necessary fields (age, diagnosis, medications, allergies) are sent un-pseudonymised.
- Chat route sends only the patient's own messages — no patient records are included.
- Drug-check uses local CDSS only — zero external API calls.

### 2.3 Storage limitation

- AI responses are cached in patient metadata for 30 days, then auto-purged.
- OpenAI API does not retain request data beyond 30 days (per their Data Usage Policy).
- No prompt/completion bodies are logged in audit events (only token counts and pseudonymised metadata).

---

## 3. Risk Assessment

### 3.1 Identified risks

| Risk                                              | Likelihood | Impact   | Mitigation                                                  |
| ------------------------------------------------- | ---------- | -------- | ----------------------------------------------------------- |
| PHI exfiltration via rogue OPENAI_BASE_URL        | Low        | Critical | F-AI-05: URL allowlist enforced at startup                  |
| Model hallucination (fabricated drug names/doses) | Medium     | High     | F-AI-03: Nightly eval harness, BNF/Vidal validation         |
| Prompt injection leaking system instructions      | Medium     | Medium   | F-AI-02/06/11/12/13: Multi-layer sanitisation               |
| Unauthorised AI use when disabled                 | Low        | Medium   | F-AI-01: Kill switch enforced at route entry                |
| Patient re-identification from pseudonymised data | Very Low   | High     | Pseudonym map held in memory only, not persisted            |
| Model version drift causing safety regression     | Low        | High     | F-AI-07: Only pinned model snapshots allowed                |
| AI outputs mistaken for doctor-authored records   | Medium     | High     | F-AI-15: `ai_generated` flag on records, visible disclaimer |

### 3.2 Residual risk

After mitigations, residual risk is **MEDIUM** — acceptable with ongoing monitoring via:

- Nightly AI evaluation harness (`.github/workflows/ai-evals.yml`)
- Audit logging of all AI invocations with token counts
- Per-clinic monthly usage caps preventing abuse
- Kill switch for immediate disable if issues arise

---

## 4. Data Subject Rights

| Right                                    | Implementation                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Access (Art. 15 GDPR / Art. 7 Law 09-08) | Patient can request all AI-generated content via data export              |
| Rectification (Art. 16)                  | Doctors can edit/override all AI-generated drafts                         |
| Erasure (Art. 17)                        | Patient data deletion cascades to AI-generated content                    |
| Restriction (Art. 18)                    | GDPR enforcement module blocks AI processing when restriction requested   |
| Objection (Art. 21)                      | Patient can object to AI processing; system falls back to manual workflow |
| Transparency (Art. 13-14)                | AI disclaimer on all outputs; `ai_generated` flag in records              |

---

## 5. Consent Flow

### 5.1 When is consent collected?

- **First use:** Before any patient data is sent to OpenAI, the system displays a consent dialog explaining:
  - What data is sent (pseudonymised patient context)
  - Where it is sent (OpenAI, US)
  - Purpose (AI-assisted clinical decision support)
  - Right to withdraw consent at any time
- **Granularity:** Consent is per-patient, per-clinic.
- **Withdrawal:** Patient can withdraw via profile settings → "AI Processing" toggle. When withdrawn, AI features fall back to manual workflow.

### 5.2 Consent storage

- Stored in `patient_consents` table with `type = 'ai_processing'`, `granted_at`, `withdrawn_at`.
- Consent status checked before AI routes process patient-specific data.

---

## 6. Third-Party Processor Agreements

| Processor            | Agreement type                                    | Key terms                                                |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| OpenAI               | API Terms of Use + Enterprise BAA (if applicable) | No training on API data, 30-day retention, SOC 2 Type II |
| Cloudflare (hosting) | DPA                                               | EU-US Data Privacy Framework, encrypted at rest          |
| Supabase (database)  | DPA                                               | Data stays in EU region, encrypted at rest               |

---

## 7. Review Schedule

- **Quarterly:** DPO reviews this DPIA and updates risk ratings.
- **On model change:** Re-run evaluation harness before approving new model version.
- **On feature change:** Update Section 1 when new AI features are added.
- **Annually:** Full DPIA reassessment with external auditor.

---

## 8. Sign-off

| Role | Name                           | Date             | Signature        |
| ---- | ------------------------------ | ---------------- | ---------------- |
| DPO  | **\*\*\*\***\_\_\_**\*\*\*\*** | \***\*\_\_\*\*** | \***\*\_\_\*\*** |
| CTO  | **\*\*\*\***\_\_\_**\*\*\*\*** | \***\*\_\_\*\*** | \***\*\_\_\*\*** |
| CISO | **\*\*\*\***\_\_\_**\*\*\*\*** | \***\*\_\_\*\*** | \***\*\_\_\*\*** |
