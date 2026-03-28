# Oltigo Platform — Task Breakdown

**Repo:** groupsmix/webs-alots | **Platform:** oltigo.com  
**Generated:** March 27, 2026

---

## Phase 12 — Patient & Doctor Experience Enhancements

### Task 12.2: Cognitive Load Reduction (Filter by Specialty)
- **Priority:** MEDIUM
- **Effort:** M (1-2 days)
- **Source:** Evaluation
- **Rationale:** 70+ feature flags mean potentially overwhelming dashboards. A GP should never see odontogram or IVF cycle tracking.
- **Subtasks:**
  1. Use `filterByFeatures()` aggressively in dashboard rendering
  2. Only show modules relevant to each doctor's specialty
  3. Add specialty-based sidebar menu filtering
  4. Add user preference for showing/hiding optional modules
- **Files:** Dashboard layout, sidebar component, feature filter logic

### Task 12.3: Patient Portal Value Enhancement
- **Priority:** LOW
- **Effort:** L (1 week)
- **Source:** Evaluation
- **Rationale:** Give patients a reason to return: prescription history, lab results, appointment history, messaging.
- **Subtasks:**
  1. Add prescription history view
  2. Add lab results view
  3. Add complete appointment history
  4. Add ability to message their doctor
  5. Wire up carnet de sante feature (strong hook)
  6. Add medication reminders
- **Files:** Patient portal components, new API endpoints

### Task 12.4: Visual Website Customization Editor
- **Priority:** LOW
- **Effort:** XL (2+ weeks)
- **Source:** Evaluation
- **Rationale:** Branding system with `clinic_branding` table and templates is powerful but not accessible. `landing-page-builder.tsx` exists. Non-technical doctors should customize their site in 10 minutes.
- **Subtasks:**
  1. Build visual drag-and-drop section editor
  2. Wire to existing template and section visibility system
  3. Add live preview
  4. Add undo/redo
  5. Add mobile preview toggle
- **Files:** `landing-page-builder.tsx`, branding admin components

### Task 12.5: In-App Support Channel
- **Priority:** LOW
- **Effort:** M (1-2 days)
- **Source:** Evaluation
- **Rationale:** Reduce "call Oltigo support" moments. The chatbot component exists. Route to WhatsApp for real-time support — dogfood your own product.
- **Subtasks:**
  1. Wire chatbot component to support routing
  2. Add FAQ/knowledge base within admin panel
  3. Add inline help tooltips on key features
  4. Route escalations to WhatsApp support
- **Files:** Chatbot component, admin panel help sections

---

## Phase 13 — Strategic / Non-Code Tasks (Ongoing)

### Task 13.1: Niche-First Marketing Launch
- **Type:** Strategy
- **Phase 1 (Months 1-3):** General Practitioners (~18K in Morocco) + Dentists (~5K) — highest volume, simplest features, fastest PMF
- **Phase 2 (Months 4-6):** Pharmacies + Physiotherapists — natural referral network from GPs
- **Phase 3 (Months 7-12):** Specialty clinics (ophthalmology, IVF, radiology) — higher ARPU, upsell

### Task 13.2: WhatsApp as Primary Differentiator
- **Type:** Marketing
- Lead messaging: "Vos patients sont sur WhatsApp. Votre cabinet devrait l'etre aussi."
- Feature WhatsApp integration prominently on landing page and in all marketing materials
- Dual-provider (Meta + Twilio) is a competitive advantage

### Task 13.3: City-by-City Launch Strategy
- **Type:** Strategy
- Start Casablanca (largest medical market) → Rabat → Marrakech
- Build local referral networks and case studies per city
- The `backfill_clinic_city` migration suggests this thinking exists

### Task 13.4: Medical Association Partnerships (CNOM)
- **Type:** Business Development
- Partner with Conseil National de l'Ordre des Medecins for credibility and distribution
- Offer co-branded "CNOM-approved digital practice" badge

### Task 13.5: Referral Program
- **Effort:** M
- Build referral tracking system
- Offer 1 month free on Starter for each successful referral
- Add referral link in doctor dashboard

### Task 13.6: Pharmacy Cross-Sell
- **Type:** Product Strategy
- Doctors on Oltigo refer patients to pharmacies also on Oltigo
- Build prescription-to-pharmacy integration (both modules exist)

### Task 13.7: Freemium Funnel Optimization
- **Type:** Product Strategy
- Free tier (2 doctors, 50 patients) is well-designed
- Make signup instant and frictionless
- Upsell triggers: hitting patient limit, needing WhatsApp notifications, wanting a custom domain

### Task 13.8: CNDP Compliance Documentation
- **Type:** Legal
- Document compliance posture for Morocco's data protection commission (CNDP)
- Create formal privacy policy and data processing documentation
- Required for enterprise sales and medical association partnerships

### Task 13.9: HL7 FHIR Readiness
- **Type:** Architecture Planning
- For eventual hospital/EMR integration, structure patient data models to be FHIR-mappable
- Long-term play, critical for enterprise accounts

### Task 13.10: Multi-Region Planning
- **Type:** Architecture Planning
- Cloudflare Workers already edge-deployed
- As expansion beyond Morocco (Tunisia, Algeria, Senegal) approaches, evaluate Supabase region or read replicas

### Task 13.11: Documentation Suite
- **Effort:** L
- Create: (1) API reference (OpenAPI — covered in Task 11.4), (2) Clinic admin user guide, (3) Patient FAQ
- Essential for reducing support load

---

## Dependency Graph

```
Phase 0 (DONE)
  └──→ Phase 1 (Immediate)
         ├── Task 1.1 (Sentry) — standalone
         ├── Task 1.2 (i18n) — standalone
         │     └──→ Phase 6 (Arabic RTL) — depends on i18n wiring
         ├── Task 1.3 (CI tests) — standalone
         ├── Task 1.4 (Error page) — standalone (or after i18n)
         ├── Task 1.5 (ARIA) — standalone
         └── Task 1.6 (Chatbot scope) — standalone

Phase 2 (SEO) — can start in parallel with Phase 1
Phase 3 (Accessibility) — can start in parallel with Phase 1
Phase 4 (Performance) — can start in parallel with Phase 2
Phase 5 (Privacy) — can start after Phase 1
Phase 7 (Growth) — depends on Phase 1 completion
  ├── Task 7.2 (Onboarding) → Task 7.3 (Tour)
  └── Task 7.4 (Analytics Dashboard) — standalone
Phase 8 (PWA/WhatsApp) — can run in parallel with Phase 7
Phase 9 (Testing) — can run in parallel with all phases
Phase 10 (Blog) — can start anytime
Phase 11 (Infrastructure) — can run in parallel with Phase 7+
Phase 12 (UX Enhancements) — depends on core features stable
Phase 13 (Strategy) — non-code, start immediately
```
