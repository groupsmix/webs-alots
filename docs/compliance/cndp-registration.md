# CNDP Registration — Oltigo Health (A247-02)

> **Audit finding:** A247-02 (Medium) — No documented CNDP registration ("déclaration / autorisation préalable") number visible in repo.

## Status

**Pending registration.** Oltigo Health processes personal health data (données à caractère personnel de santé) and must register with the CNDP under Moroccan Law 09-08 (Loi relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel).

## Registration Type

Healthcare platforms processing PHI require an **autorisation préalable** (prior authorization) under Article 12 of Law 09-08, not a simple déclaration, because:

1. Data includes health information (Article 1, sensitive data)
2. Processing involves automated decision-making (appointment scheduling, billing)
3. Data may be transferred internationally (Supabase infrastructure in EU/US regions)

## Registration Steps

1. **Prepare the dossier:**
   - Formulaire de demande d'autorisation (available at https://www.cndp.ma/)
   - Description of data processing activities (see `docs/compliance/data-flow-map.md`)
   - Data Protection Impact Assessment (see `docs/compliance/dpia.md`)
   - Security measures documentation (see `docs/archive/audit/FULL_AUDIT_REPORT.md`)
   - Data retention policy (see `docs/compliance/retention.md`)
   - Data processing agreements with sub-processors (see `docs/compliance/dpa-template.md`)

2. **Submit to CNDP:**
   - Online: https://www.cndp.ma/
   - Physical: Commission Nationale de Contrôle de la Protection des Données à Caractère Personnel, Rabat

3. **Await receipt:**
   - CNDP issues a registration receipt ("récépissé de dépôt") within 24 hours
   - Final authorization is issued within 2 months (Article 15)

## After Registration

Once the CNDP registration number is received:

1. Update this file with the registration number and date
2. Display the registration number in the platform footer and privacy policy
3. Add to `src/app/(public)/privacy/page.tsx`

## Registration Number

> **CNDP Registration #:** _Pending — submit dossier and update this field_
>
> **Date:** _Pending_
>
> **Expiry:** _N/A (no expiry for autorisations, but subject to periodic review)_

## Launch-Blocking Checklist (A70-1 / A71-1)

> **IMPORTANT:** Moroccan Law 09-08 requires CNDP registration **before**
> processing personal data in production. Do NOT go live until items 1–3
> are completed.

- [ ] **CNDP autorisation préalable** — Submit dossier and obtain registration number
- [ ] **Cross-border transfer authorization** — Obtain CNDP authorization for Morocco → EU/US data transfers (PHI stored in AWS eu-west-1, processed by US sub-processors)
- [ ] **Update this file** — Record registration number and date above
- [ ] **Display registration number** — Add to footer and privacy policy (`src/app/(public)/privacy/page.tsx`)
- [ ] **Privacy policy processor sync (A70-2)** — Verify the public privacy policy lists **all** sub-processors in `data-flow-map.md`: Supabase, Cloudflare, Stripe, CMI, Meta WhatsApp, Twilio, Resend, OpenAI, Sentry, Plausible

## Related Documents

- `docs/compliance/cndp.md` — CNDP compliance framework
- `docs/compliance/dpia.md` — Data Protection Impact Assessment
- `docs/compliance/data-flow-map.md` — Data flow mapping
- `docs/compliance/retention.md` — Data retention policy
