# Data Processing Agreement (DPA) Template

**Document ID:** ISMS-DPA-001
**Version:** 1.0
**Status:** DRAFT
**Last Updated:** 2026-04-30
**GDPR Reference:** Article 28

---

> **Note:** This is a template. Each clinic customer should receive a signed copy with their specific details filled in. Legal review is required before use.

---

## DATA PROCESSING AGREEMENT

Between:

**Data Controller:** [Clinic Name], registered at [Address], ("Controller")

**Data Processor:** Oltigo Health SARL, registered at [Address], Morocco, ("Processor")

Collectively referred to as the "Parties".

---

### 1. Subject Matter and Duration

1.1. This DPA governs the processing of personal data by the Processor on behalf of the Controller in connection with the Oltigo Health SaaS platform.

1.2. This DPA shall remain in effect for the duration of the main service agreement between the Parties.

### 2. Nature and Purpose of Processing

The Processor provides a clinic management platform that processes personal data for the purposes of:

- Patient appointment scheduling and management
- Medical record keeping (prescriptions, consultations, documents)
- Patient communication (WhatsApp notifications, SMS, email)
- Payment processing
- AI-assisted clinical decision support (optional)

### 3. Categories of Data Subjects

- Patients of the Controller's clinic
- Clinic staff (doctors, receptionists, administrators)

### 4. Types of Personal Data

| Category | Data Elements |
|---|---|
| **Identity** | Name, email, phone number, date of birth |
| **Health (PHI)** | Medical records, prescriptions, diagnoses, consultation notes, uploaded medical documents |
| **Financial** | Payment amounts, methods, insurance information |
| **Technical** | IP addresses (anonymised), session data, audit logs |

### 5. Processor Obligations

The Processor shall:

5.1. Process personal data only on documented instructions from the Controller, including transfers to third countries

5.2. Ensure persons authorised to process personal data have committed to confidentiality

5.3. Implement appropriate technical and organisational measures:
   - **Encryption:** AES-256-GCM for PHI at rest; TLS 1.3 in transit
   - **Tenant isolation:** Row Level Security + application-level `clinic_id` scoping
   - **Access control:** Role-based access (5 levels), optional 2FA
   - **Audit logging:** All state-changing operations logged
   - **Data masking:** PHI scrubbed from error tracking (Sentry)

5.4. Not engage another processor without prior written authorisation of the Controller

5.5. Assist the Controller in responding to data subject requests (access, portability, erasure)

5.6. Delete or return all personal data upon termination, at the Controller's choice

5.7. Make available all information necessary to demonstrate compliance

### 6. Sub-Processors

The Processor currently uses the following sub-processors:

| Sub-Processor | Purpose | Data Location |
|---|---|---|
| Supabase (AWS) | Database hosting | EU (Frankfurt) |
| Cloudflare | CDN, Workers, R2 storage | Global (EU primary) |
| Meta (WhatsApp Business API) | Patient notifications | EU/US |
| Twilio | SMS/WhatsApp fallback | US |
| Resend | Email notifications | US |
| Sentry | Error monitoring (PHI scrubbed) | US |
| OpenAI | AI features (optional) | US |
| Stripe | Payment processing (international) | US/EU |
| CMI | Payment processing (Morocco) | Morocco |

The Controller provides general authorisation for the above sub-processors. The Processor shall inform the Controller of any intended changes and provide an opportunity to object.

### 7. Data Transfers

Where personal data is transferred outside the EEA/Morocco, the Processor ensures adequate safeguards through:

- Standard Contractual Clauses (SCCs) with sub-processors
- Sub-processor certifications (SOC 2, ISO 27001 where available)

### 8. Data Subject Rights

The Processor provides technical capabilities to support:

- **Right of access:** Patient data export API (`GET /api/patient/export`)
- **Right to portability:** JSON/CSV export formats
- **Right to erasure:** Account deletion with 30-day grace period, automated GDPR purge cron
- **Right to rectification:** Profile editing by patients and clinic staff

### 9. Data Breach Notification

9.1. The Processor shall notify the Controller without undue delay (and within 48 hours) after becoming aware of a personal data breach

9.2. The notification shall include: nature of the breach, categories of data affected, likely consequences, and measures taken

9.3. Incident response procedures are documented in `docs/incident-response.md`

### 10. Data Retention

Personal data is retained according to the schedule in `docs/compliance/retention.md`:

- Active patient records: duration of care relationship + 10 years (Moroccan medical records law)
- Audit logs: 7 years
- Deleted accounts: purged after 30-day grace period

### 11. Audit Rights

The Controller may audit the Processor's compliance with this DPA, with reasonable notice and during business hours.

### 12. Liability

Each Party's liability under this DPA is subject to the limitations set out in the main service agreement.

---

**Signatures:**

| | Controller | Processor |
|---|---|---|
| **Name** | ___________________ | ___________________ |
| **Title** | ___________________ | ___________________ |
| **Date** | ___________________ | ___________________ |
| **Signature** | ___________________ | ___________________ |
