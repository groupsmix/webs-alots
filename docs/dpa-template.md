# Data Processing Agreement (DPA)
## Between Oltigo Health (Processor) and Clinic Customers (Controllers)

> **Reference:** A70-F2, GDPR Art.28, Moroccan Law 09-08 Art.3(2)  
> **Version:** 1.0 | **Date:** 2026-05-08 | **Review:** Annual

---

## Parties

**Data Controller ("Clinic"):**
```
Clinic Name: ___________________________
Legal Representative: ___________________________
Address: ___________________________
Email: ___________________________
CNDP Registration No. (if applicable): ___________________________
```

**Data Processor ("Oltigo Health"):**
```
Oltigo Health SARL
[Registered Address]
Email: dpo@oltigo.com
CNDP Registration No.: [PENDING — submit before go-live]
```

---

## 1. Subject Matter and Duration

1.1 This DPA governs the processing of personal data by Oltigo Health on behalf of the Clinic in connection with the Oltigo Health SaaS platform ("Service").

1.2 This DPA is effective from the date the Clinic activates the Service and remains in force until termination of the Service Agreement.

---

## 2. Nature and Purpose of Processing

Oltigo Health processes personal data solely to:
- Provide appointment scheduling, patient record management, and clinical workflows
- Send appointment reminders via WhatsApp, SMS, and email
- Process payments via Stripe (international) and CMI (Moroccan interbank)
- Generate AI-assisted clinical decision support (drug checks, prescription drafts, patient summaries)
- Maintain audit logs as required by Moroccan Law 09-08 Art.24

---

## 3. Categories of Data Subjects

- Patients registered at the Clinic
- Clinic staff (doctors, receptionists, administrators)

---

## 4. Categories of Personal Data

| Category | Sensitivity | Basis |
|---|---|---|
| Name, email, phone | Personal | Contract |
| Appointment history | Health (Art.9) | Art.9(2)(h) — healthcare |
| Prescriptions, diagnoses, clinical notes | Health/PHI (Art.9) | Art.9(2)(h) |
| Payment information | Financial | Contract |
| Activity and audit logs | Operational | Legal obligation |

---

## 5. Obligations of the Processor (Oltigo Health)

Oltigo Health shall:

5.1 **Process only on documented instructions** from the Clinic, and notify the Clinic if any instruction infringes applicable law.

5.2 **Ensure confidentiality** — all persons authorised to process personal data are bound by confidentiality obligations.

5.3 **Implement technical and organisational security measures** per Art.32 GDPR / Law 09-08 Art.23, including:
   - AES-256-GCM encryption of PHI files at rest
   - TLS 1.3 in transit
   - Role-based access control (RBAC) with per-clinic tenant isolation
   - Immutable audit logs (WORM) with 7-year retention
   - Multi-factor authentication for staff accounts

5.4 **Sub-processors:** Oltigo Health uses the following approved sub-processors:

| Sub-processor | Purpose | Location | DPA |
|---|---|---|---|
| Cloudflare | Edge infrastructure, R2 storage | EU (jurisdiction) | Cloudflare DPA |
| Supabase | Database | EU | Supabase DPA |
| OpenAI | AI decision support | US | OpenAI DPA + SCCs |
| Meta (WhatsApp) | Appointment reminders | US | Meta DPA + SCCs |
| Resend | Email notifications | US | Resend DPA + SCCs |
| Stripe | International payments | US | Stripe DPA (PCI-DSS) |
| CMI | Moroccan payments | Morocco | CMI Agreement |

5.5 **Notify the Clinic without undue delay** (and within 24 hours) upon becoming aware of a personal data breach.

5.6 **Assist the Clinic** with data subject rights requests (access, rectification, erasure, portability) within 5 business days.

5.7 **Delete or return** all personal data upon termination of the Service Agreement, within 30 days. Audit logs subject to mandatory 7-year WORM retention are pseudonymized.

5.8 **Make available** all information necessary to demonstrate compliance and allow audits by the Clinic or an auditor mandated by the Clinic, with 30 days' notice.

---

## 6. Obligations of the Controller (Clinic)

The Clinic shall:

6.1 Ensure it has a valid legal basis for processing health data (Art.9(2)(h)) — e.g., for healthcare purposes by a health professional.

6.2 Register the data processing activities with the CNDP as required by Law 09-08 Art.13.

6.3 Provide patients with the required privacy notices (Law 09-08 Art.6) informing them that Oltigo Health is a sub-processor.

6.4 Not instruct Oltigo Health to process personal data for purposes other than those specified in Section 2.

---

## 7. International Transfers

Certain sub-processors (OpenAI, Meta, Resend, Stripe) are located in the United States. Transfers are governed by EU Standard Contractual Clauses (SCCs) per GDPR Art.46(2)(c). For Moroccan data subjects, transfers comply with Law 09-08 Art.43 (Commission Nationale approval or equivalent safeguards).

---

## 8. Liability

Each party is responsible for compliance with its respective obligations under this DPA and applicable law. Oltigo Health's total liability under this DPA is limited to the amounts paid by the Clinic in the preceding 12 months, except in cases of gross negligence or wilful misconduct.

---

## 9. Governing Law

This DPA is governed by Moroccan law (Law 09-08 and the Civil Code). Disputes are subject to the jurisdiction of the courts of [City, Morocco].

---

## Signatures

**For the Clinic (Controller):**

```
Name: ___________________________
Title: ___________________________
Date: ___________________________
Signature: ___________________________
```

**For Oltigo Health SARL (Processor):**

```
Name: ___________________________
Title: ___________________________
Date: ___________________________
Signature: ___________________________
```

---

*This template should be reviewed by legal counsel before execution. Contact dpo@oltigo.com for the current signed version.*
