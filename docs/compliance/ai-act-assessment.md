# EU AI Act Compliance Assessment

**Document ID:** ISMS-AI-001
**Version:** 1.0
**Status:** DRAFT
**Last Updated:** 2026-04-30
**Regulation:** EU AI Act (Regulation 2024/1689)
**Audit Reference:** A72

---

## 1. Overview

This document assesses Oltigo Health's AI features against the EU AI Act requirements. It covers risk classification, prohibited-use checks, transparency obligations, and required mitigations.

## 2. AI Features Inventory

| Feature | Route | Model | Purpose |
|---|---|---|---|
| Auto-suggest prescriptions | `POST /api/ai/auto-suggest` | OpenAI GPT-4 | Suggest medications based on diagnosis |
| Patient summary | `POST /api/v1/ai/patient-summary` | OpenAI GPT-4 | Generate patient summary cards |
| Manager insights | `POST /api/ai/manager` | OpenAI GPT-4 | Business analytics Q&A |
| WhatsApp receptionist | `POST /api/ai/whatsapp-receptionist` | OpenAI GPT-4 | Automated patient replies |
| Chat assistant | `POST /api/chat` | OpenAI GPT-4 | General clinic assistant |

## 3. Risk Classification

### 3.1 Assessment

Under EU AI Act Article 6 and Annex III, AI systems intended for use as **medical devices** or **safety components of medical devices** are classified as **high-risk**.

**Our assessment:** Oltigo Health's AI features are **decision-support tools** that assist clinicians. They do NOT:

- Make autonomous clinical decisions
- Replace physician judgment
- Qualify as medical devices under MDR 2017/745

The auto-suggest feature provides prescription suggestions that a doctor must explicitly review and approve before any prescription is issued. This places the system in the **limited-risk** category (transparency obligations apply).

### 3.2 Rationale

- All AI outputs are clearly labelled as drafts requiring human review
- The physician retains full decision-making authority
- No automated actions are taken based on AI output
- AI features are optional and can be disabled per clinic

## 4. Article 5 — Prohibited Practices Check

| Prohibited Practice | Applicable? | Assessment |
|---|---|---|
| **Social scoring** | No | Platform does not score or rank patients based on social behaviour |
| **Subliminal manipulation** | No | AI suggestions are transparent and clearly labelled; no hidden persuasion |
| **Exploitation of vulnerabilities** | No | No targeting of vulnerable groups for manipulation |
| **Real-time remote biometric identification** | No | Platform does not use biometric data or identification |
| **Emotion recognition in workplace/education** | No | No emotion detection features |
| **Biometric categorisation (sensitive attributes)** | No | No biometric processing |
| **Predictive policing** | No | Not applicable to healthcare platform |
| **Facial recognition database scraping** | No | No facial recognition features |

**Conclusion:** None of the prohibited practices in Article 5 apply to Oltigo Health.

## 5. Transparency Obligations (Article 50)

### 5.1 AI-Generated Content Labelling (A72-F2)

**Requirement:** AI-generated content must be visibly labelled so users know it was produced by an AI system.

**Implementation:**

- All AI responses include the disclaimer defined in `src/lib/ai-disclaimer.ts`
- Disclaimer available in English, French, and Arabic
- Applied to: prescription suggestions, patient summaries, manager insights, chat responses

**Standard disclaimer:**
> "AI-generated draft -- review before use. This content was produced by an AI model and may contain errors."

### 5.2 Human Oversight

- Prescription suggestions require explicit doctor approval before saving
- Patient summaries are read-only reference material
- Manager insights are advisory, not actionable without human decision
- WhatsApp receptionist responses are scoped to appointment booking (no clinical advice)

## 6. Data Protection

- AI prompts include only the minimum patient data needed for the specific task
- Patient data is not used for model training (OpenAI API data usage policy: data not retained)
- PHI is sanitised before inclusion in AI prompts where possible (`src/lib/ai/sanitize.ts`)
- AI usage is logged for audit purposes (token counts, clinic ID, trigger type)

## 7. Monitoring and Review

| Control | Frequency |
|---|---|
| Review AI feature outputs for accuracy | Quarterly |
| Update sub-processor list if AI provider changes | On change |
| Re-assess risk classification | Annually or on feature change |
| Review prohibited-use checklist | Annually |
| Audit AI disclaimer visibility | Per release |

## 8. Open Items

| Item | Priority | Status |
|---|---|---|
| Add AI disclaimer to all AI response payloads | P2 | In progress (`src/lib/ai-disclaimer.ts` created) |
| Implement human feedback loop for AI suggestions | P3 | Planned |
| Document AI model version and capabilities | P3 | Planned |
| Add AI usage metrics per tenant | P2 | See A80-F1 |

---

**Approval:**

| Name | Role | Date | Signature |
|---|---|---|---|
| ___________________ | CTO | __________ | __________ |
| ___________________ | Legal Counsel | __________ | __________ |
