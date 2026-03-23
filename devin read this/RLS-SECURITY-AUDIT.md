# Row Level Security & Tenant Isolation — Security Audit

**Date:** 2026-03-23
**Auditor:** Devin (Cognition AI)
**Scope:** Supabase migrations (RLS policies), tables with `clinic_id`, API routes interacting with DB
**Approach:** Attacker mindset — aggressive, critical, focused on real risks

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [RLS Coverage Matrix](#2-rls-coverage-matrix)
3. [Critical Vulnerabilities](#3-critical-vulnerabilities)
4. [High-Severity Vulnerabilities](#4-high-severity-vulnerabilities)
5. [Medium-Severity Vulnerabilities](#5-medium-severity-vulnerabilities)
6. [Trust Boundary Analysis](#6-trust-boundary-analysis)
7. [Attack Scenarios (Step-by-Step)](#7-attack-scenarios-step-by-step)
8. [Mitigated Issues (Audit Trail)](#8-mitigated-issues-audit-trail)
9. [Recommendations](#9-recommendations)

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| Tables audited | 90+ |
| Tables with RLS enabled | 90+ (good) |
| **CRITICAL findings (active)** | **2** |
| **HIGH findings (active)** | **6** |
| **MEDIUM findings (active)** | **7** |
| Mitigated findings (00028) | 3 |

**Overall risk level: HIGH**

The platform has made significant progress in migration `00028_security_hardening.sql` to address the most dangerous privilege escalation vector (auth trigger). However, several **active cross-tenant write vulnerabilities** remain in RLS policies where `WITH CHECK` clauses are missing `clinic_id` enforcement. Additionally, multiple tables expose data publicly across all tenants via `USING (TRUE)` SELECT policies.

The server-side API layer (`withAuth`, middleware tenant resolution, API key auth) is **well-designed** and correctly derives `clinic_id` from server-side state rather than client input, with one notable exception in the chat endpoint.

---

## 2. RLS Coverage Matrix

### Core Tables (00002)

| Table | RLS Enabled | clinic_id Enforced (USING) | clinic_id Enforced (WITH CHECK) | Issues |
|-------|:-----------:|:-------------------------:|:-------------------------------:|--------|
| clinics | ✓ | ✓ | ✓ | Fixed in 00028 |
| users | ✓ | ✓ | Partial | Fixed in 00028 |
| services | ✓ | ✓ | ✓ | — |
| time_slots | ✓ | ✓ | ✓ | — |
| appointments | ✓ | ✓ | ✓ | — |
| waiting_list | ✓ | ✓ | ✓ | — |
| notifications | ✓ | Partial | **NO** | **HIGH-01** |
| payments | ✓ | ✓ | ✓ | — |
| reviews | ✓ | ✓ | ✓ | — |
| documents | ✓ | ✓ | **Partial** | **MED-01** |
| consultation_notes | ✓ | ✓ (via JOIN) | ✓ | — |
| prescriptions | ✓ | ✓ (via JOIN) | ✓ | — |
| family_members | ✓ | ✓ (via JOIN) | ✓ | — |
| odontogram | ✓ | ✓ (via JOIN) | **NO** | **CRITICAL-01** |
| treatment_plans | ✓ | ✓ (via JOIN) | ✓ | — |
| lab_orders | ✓ | ✓ | ✓ | — |
| installments | ✓ | ✓ (via JOIN) | **NO** | **CRITICAL-02** |
| sterilization_log | ✓ | ✓ | ✓ | — |
| products | ✓ | ✓ | ✓ | — |
| stock | ✓ | ✓ | ✓ | — |
| suppliers | ✓ | ✓ | ✓ | — |
| prescription_requests | ✓ | ✓ | Partial | **MED-02** |
| loyalty_points | ✓ | ✓ | ✓ | — |

### Schema Gaps Tables (00005, 00019)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| blog_posts | ✓ | ✓ | — |
| announcements | ✓ | N/A (platform-level) | — |
| activity_logs | ✓ | ✓ | — |
| platform_billing | ✓ | ✓ | — |
| feature_definitions | ✓ | N/A (global) | — |
| clinic_feature_overrides | ✓ | ✓ | — |
| pricing_tiers | ✓ | N/A (global) | — |
| subscriptions | ✓ | ✓ | — |
| subscription_invoices | ✓ | ✓ (via JOIN) | — |
| feature_toggles | ✓ | N/A (global) | — |
| sales | ✓ | ✓ | — |
| on_duty_schedule | ✓ | ✓ | — |
| before_after_photos | ✓ | ✓ | — |
| pain_questionnaires | ✓ | ✓ | — |
| appointment_doctors | ✓ | Partial | — |
| clinic_holidays | ✓ | ✓ | — |
| purchase_orders | ✓ | ✓ | — |
| purchase_order_items | ✓ | ✓ (via JOIN) | — |
| loyalty_transactions | ✓ | ✓ | — |
| medical_certificates | ✓ | ✓ | — |

### Chatbot Tables (00008)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| chatbot_config | ✓ | Partial | **HIGH-02** — public SELECT `USING (TRUE)` |
| chatbot_faqs | ✓ | Partial | **HIGH-03** — public SELECT for active FAQs |

### Specialty Modules (00011, 00018)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| pediatrics_* (13 tables) | ✓ | ✓ | — |
| gynecology_* | ✓ | ✓ | — |
| ophthalmology_* | ✓ | ✓ | — |
| dermatology_* | ✓ | ✓ | — |
| cardiology_* | ✓ | ✓ | — |
| ent_* | ✓ | ✓ | — |
| orthopedics_* | ✓ | ✓ | — |
| psychiatry_* | ✓ | ✓ | — |
| neurology_* | ✓ | ✓ | — |
| urology_* | ✓ | ✓ | — |
| pulmonology_* | ✓ | ✓ | — |
| endocrinology_* | ✓ | ✓ | — |
| rheumatology_* | ✓ | ✓ | — |

### Para-Medical Tables (00013 → fixed in 00019)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| exercise_programs | ✓ | ✓ | Was `USING(true)` in 00013, fixed in 00019 |
| physio_sessions | ✓ | ✓ | Same pattern — fixed |
| progress_photos | ✓ | ✓ | Same pattern — fixed |
| meal_plans | ✓ | ✓ | Same pattern — fixed |
| body_measurements | ✓ | ✓ | Same pattern — fixed |
| therapy_session_notes | ✓ | ✓ | Same pattern — fixed |
| therapy_plans | ✓ | ✓ | Same pattern — fixed |
| speech_exercises | ✓ | ✓ | Same pattern — fixed |
| speech_sessions | ✓ | ✓ | Same pattern — fixed |
| speech_progress_reports | ✓ | ✓ | Same pattern — fixed |
| lens_inventory | ✓ | ✓ | Same pattern — fixed |
| frame_catalog | ✓ | ✓ | Same pattern — fixed |
| optical_prescriptions | ✓ | ✓ | Same pattern — fixed |

### Diagnostic/Lab/Equipment (00014, 00018)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| lab_test_orders | ✓ | ✓ | — |
| lab_test_items | ✓ | ✓ (via JOIN) | — |
| lab_test_results | ✓ | ✓ (via JOIN) | — |
| radiology_orders | ✓ | ✓ | — |
| radiology_images | ✓ | ✓ | — |
| radiology_report_templates | ✓ | ✓ | — |
| parapharmacy_categories | ✓ | ✓ | — |
| equipment_inventory | ✓ | ✓ | — |
| equipment_rentals | ✓ | ✓ | — |
| equipment_maintenance | ✓ | ✓ | — |

### Phase 6 Tables (00015, fixed in 00019)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| departments | ✓ | ✓ | Staff write added in 00019 |
| rooms | ✓ | ✓ | Same |
| beds | ✓ | ✓ | Same |
| admissions | ✓ | ✓ | Same |
| photo_consent_forms | ✓ | ✓ | Same |
| treatment_packages | ✓ | ✓ | Same |
| patient_packages | ✓ | ✓ | Same |
| consultation_photos | ✓ | ✓ | Same |
| ivf_cycles | ✓ | ✓ | Same |
| ivf_protocols | ✓ | ✓ | Same |
| ivf_timeline_events | ✓ | ✓ | Same |
| dialysis_machines | ✓ | ✓ | Same |
| dialysis_sessions | ✓ | ✓ | Same |
| prosthetic_orders | ✓ | ✓ | Same |
| lab_materials | ✓ | ✓ | Same |
| lab_deliveries | ✓ | ✓ | Same |
| lab_invoices | ✓ | ✓ | Same |

### Custom Fields (00016)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| custom_field_definitions | ✓ | N/A (global ref data) | **MED-03** — public SELECT |
| custom_field_values | ✓ | ✓ | **MED-04** — no role check |
| custom_field_overrides | ✓ | ✓ | — |

### Missing Tables (00023)

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| invoices | ✓ | ✓ | — |
| invoice_items | ✓ | ✓ (via JOIN) | — |
| collection_points | ✓ | **NO** | **HIGH-04** — public SELECT `USING (TRUE)` |
| lab_tests | ✓ | **NO** | **HIGH-05** — public SELECT `USING (is_active = TRUE)` |
| medical_records | ✓ | ✓ | — |

### Other Tables

| Table | RLS Enabled | clinic_id Enforced | Issues |
|-------|:-----------:|:-----------------:|--------|
| notification_log (00020) | ✓ | ✓ | — |
| clinic_api_keys | ✓ | ✓ | — |

---

## 3. Critical Vulnerabilities

### CRITICAL-01: Cross-Tenant Odontogram Write via Missing WITH CHECK

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 501-510
**Risk:** CRITICAL
**Status:** ACTIVE — not addressed in 00028

```sql
CREATE POLICY "odontogram_manage_doctor" ON odontogram
  FOR ALL USING (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = odontogram.patient_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('doctor', 'clinic_admin')
    -- ⚠️ NO clinic_id ENFORCEMENT ON INSERT/UPDATE
  );
```

**Impact:** A doctor or clinic_admin from **Clinic A** can INSERT odontogram records that reference a `patient_id` belonging to **Clinic B**. The `USING` clause correctly checks the existing row's patient belongs to the user's clinic, but the `WITH CHECK` clause (applied on INSERT/UPDATE) only checks the role — not the clinic.

**Attack vector:**
1. Attacker is a doctor at Clinic A
2. Attacker discovers/guesses a `patient_id` UUID from Clinic B
3. Attacker calls `supabase.from('odontogram').insert({ patient_id: 'clinic-b-patient-uuid', ... })`
4. `WITH CHECK` passes because role = 'doctor' ✓
5. The record is created, associating Clinic A doctor's data with Clinic B's patient

**Fix:**
```sql
WITH CHECK (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = odontogram.patient_id
        AND u.clinic_id = get_user_clinic_id()
    )
);
```

---

### CRITICAL-02: Cross-Tenant Installment Write via Missing WITH CHECK

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 569-580
**Risk:** CRITICAL
**Status:** ACTIVE — not addressed in 00028

```sql
CREATE POLICY "installments_manage_staff" ON installments
  FOR ALL USING (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND EXISTS (
      SELECT 1 FROM treatment_plans tp
      JOIN users u ON u.id = tp.doctor_id
      WHERE tp.id = installments.treatment_plan_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist')
    -- ⚠️ NO clinic_id OR treatment_plan ENFORCEMENT ON INSERT/UPDATE
  );
```

**Impact:** A clinic_admin or receptionist from **Clinic A** can INSERT installment records linked to treatment plans from **Clinic B**. The `USING` clause correctly validates via JOIN, but `WITH CHECK` only checks role.

**Attack vector:**
1. Attacker is receptionist at Clinic A
2. Attacker knows a `treatment_plan_id` from Clinic B
3. Attacker inserts: `{ treatment_plan_id: 'clinic-b-plan', patient_id: 'clinic-b-patient', amount: 0, ... }`
4. `WITH CHECK` passes: role = 'receptionist' ✓
5. Financial data corruption across tenants

**Fix:**
```sql
WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND EXISTS (
      SELECT 1 FROM treatment_plans tp
      JOIN users u ON u.id = tp.doctor_id
      WHERE tp.id = installments.treatment_plan_id
        AND u.clinic_id = get_user_clinic_id()
    )
);
```

---

## 4. High-Severity Vulnerabilities

### HIGH-01: Notifications INSERT Has No Tenant Scoping

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 348-351
**Risk:** HIGH

```sql
CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
    -- ⚠️ No clinic_id check. No user_id ownership check.
  );
```

**Impact:** Any staff member from any clinic can insert notification records for ANY `user_id` in the system. A malicious doctor at Clinic A could spam patients at Clinic B with fake notifications.

**Note:** The API route (`/api/notifications`) does perform a server-side check (`recipient.clinic_id !== profile.clinic_id`), providing defense-in-depth. However, if an attacker bypasses the API and uses the Supabase client directly (e.g., via the anon key + their JWT), the RLS policy alone does not prevent cross-tenant notification injection.

---

### HIGH-02: Chatbot Config Public SELECT Exposes All Clinics

**File:** `supabase/migrations/00008_chatbot_tables.sql` lines 55-56
**Risk:** HIGH

```sql
CREATE POLICY "chatbot_config_select_public" ON chatbot_config
  FOR SELECT USING (TRUE);
```

**Impact:** Any user (including unauthenticated) can query `chatbot_config` and enumerate ALL clinics' chatbot settings: intelligence level, greeting messages, accent colors, language preferences. This is an information disclosure that reveals operational details about every tenant.

**Note:** The chatbot needs public access to its own clinic's config, but should be scoped by clinic_id (via tenant header or direct filter), not globally open.

---

### HIGH-03: Chatbot FAQs Leak Across Tenants

**File:** `supabase/migrations/00008_chatbot_tables.sql` lines 69-70
**Risk:** HIGH

```sql
CREATE POLICY "chatbot_faqs_select_public" ON chatbot_faqs
  FOR SELECT USING (is_active = TRUE);
```

**Impact:** Any user can read ALL active FAQs from ALL clinics. FAQ content may include clinic-specific medical information, pricing, procedures, contact details, and operational data that should be tenant-scoped.

---

### HIGH-04: Collection Points Public SELECT — No Tenant Scoping

**File:** `supabase/migrations/00023_missing_tables.sql` lines 186-187
**Risk:** HIGH

```sql
CREATE POLICY "public_collection_points_read" ON collection_points
  FOR SELECT USING (TRUE);
```

**Impact:** Exposes all collection points (with addresses, phone numbers, GPS coordinates, accessibility info) across all clinics to anyone. An attacker can enumerate all lab sample collection locations for competitive intelligence or social engineering.

---

### HIGH-05: Lab Tests Public SELECT — No Tenant Scoping

**File:** `supabase/migrations/00023_missing_tables.sql` lines 189-190
**Risk:** HIGH

```sql
CREATE POLICY "public_lab_tests_read" ON lab_tests
  FOR SELECT USING (is_active = TRUE);
```

**Impact:** All active lab test catalogs across all clinics are readable by anyone. Exposes pricing, test descriptions, preparation instructions across tenants.

---

### HIGH-06: Chat API Accepts clinicId from Request Body

**File:** `src/app/api/chat/route.ts` line 83
**Risk:** HIGH

```typescript
const clinicId = tenantClinicId || body.clinicId;
```

**Impact:** When the `x-tenant-clinic-id` header is not set (e.g., requests not going through a subdomain), the chat endpoint falls back to a user-supplied `clinicId` in the request body. An attacker can:

1. Send `POST /api/chat` to the root domain (no subdomain → no tenant header)
2. Include `{ clinicId: "target-clinic-uuid", messages: [...] }` in the body
3. The endpoint calls `fetchChatbotContext(clinicId)` with the attacker-controlled clinic ID
4. Receive another clinic's chatbot context: services, doctors, FAQs, operating hours

While authentication is required (SEC-01), any authenticated user from any clinic can probe other clinics' chatbot data.

---

## 5. Medium-Severity Vulnerabilities

### MED-01: Documents INSERT Lacks clinic_id Enforcement

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 404-405
**Risk:** MEDIUM

```sql
CREATE POLICY "documents_insert_own" ON documents
  FOR INSERT WITH CHECK (user_id = get_my_user_id());
```

**Impact:** A user can insert a document with any `clinic_id` (or null). The `user_id` check ensures they can only create documents for themselves, but the document could reference a wrong clinic, causing data integrity issues. Not a direct data leak, but enables data pollution.

---

### MED-02: Prescription Requests Patient Write Lacks clinic_id

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 644-646
**Risk:** MEDIUM

```sql
CREATE POLICY "prescription_requests_manage_patient" ON prescription_requests
  FOR ALL USING (patient_id = get_my_user_id())
  WITH CHECK (patient_id = get_my_user_id());
```

**Impact:** A patient can insert a prescription request with a `clinic_id` different from their own. While the patient can only create requests for themselves, the request could appear in a different clinic's workflow.

---

### MED-03: Custom Field Definitions Publicly Readable

**File:** `supabase/migrations/00016_custom_fields.sql` lines 100-101
**Risk:** MEDIUM

```sql
CREATE POLICY "cfd_select_all" ON custom_field_definitions
  FOR SELECT USING (true);
```

**Impact:** All custom field definitions (including clinic-type-specific fields like tooth numbers, drug classes, refraction values) are readable by anyone. While these are reference data, they reveal the full schema of what each clinic type collects, aiding targeted attacks.

---

### MED-04: Custom Field Values — No Role Restriction on Write

**File:** `supabase/migrations/00016_custom_fields.sql` lines 114-118
**Risk:** MEDIUM

```sql
CREATE POLICY "cfv_insert_own_clinic" ON custom_field_values
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())
    OR is_super_admin()
  );
```

**Impact:** Any user at a clinic (including patients) can insert/update/delete custom field values for their clinic. Patients should not be able to modify field values — only staff should write. This allows a patient to tamper with custom field data for their own appointments/records.

---

### MED-05: `is_clinic_staff()` Has No Clinic Parameter

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 77-84
**Risk:** MEDIUM

```sql
CREATE OR REPLACE FUNCTION is_clinic_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('clinic_admin', 'receptionist', 'doctor')
    -- ⚠️ No clinic_id filter — returns TRUE if user is staff at ANY clinic
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Impact:** The function returns `TRUE` if the user is staff at **any** clinic, not a specific one. All current callers combine it with `clinic_id = get_user_clinic_id()` in the USING clause, which is correct. However, this is a latent risk — any future policy that uses `is_clinic_staff()` alone (without also checking clinic_id) would have a cross-tenant vulnerability. Defense-in-depth recommends adding a `clinic_id` parameter.

---

### MED-06: Reviews SELECT Exposes Patient Data Within Clinic

**File:** `supabase/migrations/00002_auth_rls_roles.sql` lines 385-386
**Risk:** MEDIUM

```sql
CREATE POLICY "reviews_select_clinic" ON reviews
  FOR SELECT USING (clinic_id = get_user_clinic_id());
```

**Impact:** Any user at a clinic can read ALL reviews for that clinic, including `patient_id` associations. A receptionist can see which patients left which reviews. In healthcare, review authorship can be sensitive.

---

### MED-07: API Route `/api/custom-fields` GET Is Unauthenticated

**File:** `src/app/api/custom-fields/route.ts` lines 15-57
**Risk:** MEDIUM

The GET handler directly queries Supabase without using `withAuth`. Combined with the public SELECT RLS policy on `custom_field_definitions`, this exposes all field definitions to unauthenticated users.

---

## 6. Trust Boundary Analysis

### Server-Side Tenant Resolution ✅ GOOD

| Component | clinic_id Source | Trusted? |
|-----------|-----------------|----------|
| Middleware (`src/middleware.ts`) | Resolved from subdomain via DB lookup | ✅ Server-controlled |
| `getTenant()` (`src/lib/tenant.ts`) | Read from `x-tenant-*` headers set by middleware | ✅ Server-controlled |
| `withAuth()` (`src/lib/with-auth.ts`) | `profile.clinic_id` from DB via `auth_id = user.id` | ✅ Server-controlled |
| `authenticateApiKey()` (`src/lib/api-auth.ts`) | `clinic_id` from API key hash lookup | ✅ Server-controlled |
| Upload route (`src/app/api/upload/route.ts`) | `profile.clinic_id` from auth context | ✅ Server-controlled |
| Booking route (`src/app/api/booking/route.ts`) | `clinicConfig.clinicId` (static server config) | ✅ Server-controlled |
| V1 API routes | `auth.clinicId` from API key authentication | ✅ Server-controlled |

### Trust Boundary Violations ❌

| Component | clinic_id Source | Issue |
|-----------|-----------------|-------|
| Chat route (`src/app/api/chat/route.ts`) | Falls back to `body.clinicId` from request | ❌ **Client-controlled fallback** |

### SECURITY DEFINER Functions — Audit

All RLS helper functions use `SECURITY DEFINER`, meaning they execute with the function owner's privileges (bypassing RLS on the `users` table they query). This is **necessary and correct** for their purpose, but creates a coupling risk:

| Function | Queries | Risk |
|----------|---------|------|
| `get_my_user_id()` | `users.id WHERE auth_id = auth.uid()` | Low — returns own ID |
| `get_user_clinic_id()` | `users.clinic_id WHERE auth_id = auth.uid()` | Low — returns own clinic |
| `get_user_role()` | `users.role WHERE auth_id = auth.uid()` | Low — returns own role |
| `is_super_admin()` | `users WHERE auth_id AND role = 'super_admin'` | Low — boolean check |
| `is_clinic_admin(uuid)` | `users WHERE auth_id AND role AND clinic_id` | Low — parameterized |
| `is_clinic_staff()` | `users WHERE auth_id AND role IN (...)` | **Medium** — no clinic_id param |

**Key risk:** If an attacker could manipulate the `users` table (e.g., via the now-fixed `users_insert_auth_trigger` policy), they could escalate privileges through these functions. The 00028 fix significantly reduces this risk.

---

## 7. Attack Scenarios (Step-by-Step)

### Attack 1: Cross-Tenant Dental Record Injection (CRITICAL-01)

**Preconditions:** Attacker has a doctor account at Clinic A. Knows (or brute-forces) a patient UUID from Clinic B.

**Steps:**
1. Attacker authenticates as doctor at Clinic A
2. Uses the Supabase JS client (available via the anon key + their auth JWT):
   ```js
   const { error } = await supabase.from('odontogram').insert({
     patient_id: 'clinic-b-patient-uuid',
     tooth_number: 11,
     condition: 'malicious-data',
     clinic_id: 'clinic-b-uuid', // or even attacker's own clinic
   });
   ```
3. RLS `WITH CHECK` evaluates: `get_user_role() IN ('doctor', 'clinic_admin')` → TRUE ✓
4. **Record is created** — dental record for Clinic B patient is now polluted
5. Clinic B staff will see false dental records for their patient

**Impact:** Medical data integrity compromise. In dentistry, incorrect odontogram data could lead to wrong tooth being treated.

---

### Attack 2: Cross-Tenant Financial Record Injection (CRITICAL-02)

**Preconditions:** Attacker is receptionist at Clinic A. Knows a `treatment_plan_id` from Clinic B.

**Steps:**
1. Attacker authenticates as receptionist at Clinic A
2. Inserts a fraudulent installment:
   ```js
   await supabase.from('installments').insert({
     treatment_plan_id: 'clinic-b-treatment-plan-uuid',
     patient_id: 'clinic-b-patient-uuid',
     amount: 50000,
     due_date: '2026-01-01',
     status: 'paid',
   });
   ```
3. RLS `WITH CHECK` evaluates: `get_user_role() IN ('clinic_admin', 'receptionist')` → TRUE ✓
4. **Financial record created** in Clinic B's treatment plan

**Impact:** Financial data corruption. Could show false payment records, affect revenue reporting, or create phantom debts.

---

### Attack 3: Cross-Tenant Notification Spam (HIGH-01)

**Preconditions:** Attacker is doctor at Clinic A. Knows user UUIDs from Clinic B.

**Steps:**
1. Attacker bypasses the API layer and uses the Supabase client directly
2. Inserts notifications:
   ```js
   await supabase.from('notifications').insert({
     user_id: 'clinic-b-user-uuid',
     type: 'reminder',
     message: 'Your appointment is cancelled',
     channel: 'in_app',
   });
   ```
3. RLS `WITH CHECK` evaluates: `get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')` → TRUE ✓
4. Clinic B user receives fake notification

**Impact:** Social engineering, patient confusion, reputation damage.

---

### Attack 4: Chatbot Context Theft (HIGH-06)

**Preconditions:** Attacker has any authenticated account. Knows target clinic UUID.

**Steps:**
1. Attacker sends request to root domain (no subdomain → no tenant header):
   ```
   POST /api/chat
   Content-Type: application/json
   Cookie: [attacker's auth cookie]

   {
     "clinicId": "target-clinic-uuid",
     "messages": [{ "role": "user", "content": "What services do you offer?" }]
   }
   ```
2. Server: `tenantClinicId` is null (no subdomain), falls back to `body.clinicId`
3. `fetchChatbotContext("target-clinic-uuid")` returns target clinic's doctors, services, hours, FAQs
4. Chatbot responds with target clinic's information

**Impact:** Competitive intelligence. Attacker can enumerate all services, pricing, doctors, and operating hours of any clinic in the platform.

---

### Attack 5: Bulk Clinic Enumeration via Public Policies

**Preconditions:** None — works unauthenticated.

**Steps:**
1. Query all chatbot configs:
   ```
   GET /rest/v1/chatbot_config?select=*
   ```
2. Query all active FAQs:
   ```
   GET /rest/v1/chatbot_faqs?select=*&is_active=eq.true
   ```
3. Query all collection points:
   ```
   GET /rest/v1/collection_points?select=*
   ```
4. Query all lab tests:
   ```
   GET /rest/v1/lab_tests?select=*&is_active=eq.true
   ```

**Impact:** Complete enumeration of all clinics' chatbot configurations, FAQ content, sample collection locations (with GPS), and lab test catalogs. Useful for competitive intelligence, targeted phishing, or social engineering.

---

### Attack 6: Patient Tampering with Custom Field Values (MED-04)

**Preconditions:** Attacker is a patient at a clinic.

**Steps:**
1. Patient queries their custom field values:
   ```js
   const { data } = await supabase.from('custom_field_values')
     .select('*')
     .eq('clinic_id', 'my-clinic-id');
   ```
2. Patient modifies medical custom fields (e.g., tooth_number, refraction values):
   ```js
   await supabase.from('custom_field_values')
     .update({ field_values: { tooth_number: '99' } })
     .eq('entity_id', 'my-appointment-id')
     .eq('entity_type', 'appointment');
   ```
3. RLS passes: `clinic_id IN (SELECT clinic_id FROM users WHERE auth_id = auth.uid())` → TRUE ✓

**Impact:** Patient can tamper with medical custom field data that staff relies on.

---

## 8. Mitigated Issues (Audit Trail)

These issues were identified and fixed in `00028_security_hardening.sql`:

### MITIGATED-01: Auth Trigger Privilege Escalation (was CRITICAL)

**Original:** `handle_new_auth_user()` read `role` and `clinic_id` from `raw_user_meta_data` (user-controlled during signup).
**Fix:** Now defaults to `'patient'`, only reads from `raw_app_meta_data` (server-controlled) for invited users. Role whitelist: `('receptionist', 'doctor', 'patient')` — super_admin and clinic_admin cannot be set via invitation.

### MITIGATED-02: Users INSERT Policy Was `WITH CHECK (TRUE)` (was CRITICAL)

**Original:** `users_insert_auth_trigger` policy allowed ANY authenticated user to insert ANY user record with any role.
**Fix:** Replaced with `users_insert_self_only`: restricts to `auth_id = auth.uid() AND role = 'patient'`.

### MITIGATED-03: Clinics Public SELECT Was Unscoped (was HIGH)

**Original:** `clinics_select_active_public` used `USING (status = 'active')` — any authenticated user could see all active clinics' full details.
**Fix:** Now restricted to own clinic, unauthenticated (public directory), or super_admin.

---

## 9. Recommendations

### Immediate (CRITICAL — Fix Now)

1. **Fix CRITICAL-01 and CRITICAL-02:** Add `clinic_id` enforcement to the `WITH CHECK` clauses of `odontogram_manage_doctor` and `installments_manage_staff`. Create a new migration (e.g., `00029_fix_write_check_policies.sql`):

```sql
-- Fix CRITICAL-01: odontogram cross-tenant write
DROP POLICY IF EXISTS "odontogram_manage_doctor" ON odontogram;
CREATE POLICY "odontogram_manage_doctor" ON odontogram
  FOR ALL USING (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = odontogram.patient_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('doctor', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = odontogram.patient_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );

-- Fix CRITICAL-02: installments cross-tenant write
DROP POLICY IF EXISTS "installments_manage_staff" ON installments;
CREATE POLICY "installments_manage_staff" ON installments
  FOR ALL USING (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND EXISTS (
      SELECT 1 FROM treatment_plans tp
      JOIN users u ON u.id = tp.doctor_id
      WHERE tp.id = installments.treatment_plan_id
        AND u.clinic_id = get_user_clinic_id()
    )
  ) WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist')
    AND EXISTS (
      SELECT 1 FROM treatment_plans tp
      JOIN users u ON u.id = tp.doctor_id
      WHERE tp.id = installments.treatment_plan_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );
```

### High Priority (Fix This Sprint)

2. **Fix HIGH-01:** Add `clinic_id` enforcement to `notifications_insert_staff`:
```sql
DROP POLICY IF EXISTS "notifications_insert_staff" ON notifications;
CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT WITH CHECK (
    get_user_role() IN ('clinic_admin', 'receptionist', 'doctor')
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = notifications.user_id
        AND u.clinic_id = get_user_clinic_id()
    )
  );
```

3. **Fix HIGH-02/03:** Scope chatbot public SELECT policies to the requesting clinic:
```sql
DROP POLICY IF EXISTS "chatbot_config_select_public" ON chatbot_config;
CREATE POLICY "chatbot_config_select_public" ON chatbot_config
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR auth.uid() IS NULL  -- unauthenticated chatbot widget
  );
```

4. **Fix HIGH-04/05:** Scope public data by clinic:
```sql
DROP POLICY IF EXISTS "public_collection_points_read" ON collection_points;
CREATE POLICY "public_collection_points_read" ON collection_points
  FOR SELECT USING (
    clinic_id = get_user_clinic_id()
    OR auth.uid() IS NULL
  );
```

5. **Fix HIGH-06:** Remove the `body.clinicId` fallback in the chat route:
```typescript
// src/app/api/chat/route.ts line 83
const clinicId = tenantClinicId;  // Remove: || body.clinicId
```

### Medium Priority (Next Sprint)

6. **Fix MED-01/02:** Add `clinic_id` enforcement to document and prescription_request INSERT policies.

7. **Fix MED-04:** Add role check to custom_field_values write policies — restrict to staff roles.

8. **Fix MED-05:** Add a `check_clinic_id` parameter to `is_clinic_staff()` for defense-in-depth:
```sql
CREATE OR REPLACE FUNCTION is_clinic_staff(check_clinic_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('clinic_admin', 'receptionist', 'doctor')
      AND (check_clinic_id IS NULL OR clinic_id = check_clinic_id)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Systematic Audit Rule

**For every RLS policy with `FOR ALL` or `FOR INSERT`:** verify that the `WITH CHECK` clause mirrors the tenant-scoping logic in the `USING` clause. The pattern should be:
- `USING` checks: "can this user see/modify **existing** rows?"
- `WITH CHECK` checks: "can this user create/modify rows **to these values**?"

Both must enforce `clinic_id` scoping. A `WITH CHECK` that only validates role is a cross-tenant write vulnerability.

---

*End of audit. All findings are based on static analysis of migration files and API route source code. No live database was accessed.*
