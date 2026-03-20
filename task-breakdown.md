# Task Breakdown — Medical SaaS (Doctor + Dentist + Pharmacy)

Since you already have a demo, I recommend sending tasks in **phases**. Each task below is one Devin session. Send them **one at a time**, in order. Each builds on the previous.

---

## PHASE 1 — Foundation & Shared Infrastructure (Tasks 1–5)

### Task 1: Supabase Schema + Auth + Role System
> Set up the complete Supabase database schema for all 3 systems (shared tables + doctor extras + dentist extras + pharmacy extras). Implement Row Level Security (RLS) policies for the 5 user roles (Super Admin, Clinic Admin, Receptionist, Doctor, Patient). Set up Supabase Auth with phone/OTP login. Create seed data for testing.

### Task 2: Super Admin Panel — Core
> Build the Super Admin dashboard: list all clinics, create new clinic, per-clinic stats, billing management, suspend/activate accounts, login-as-client, system announcements, feature toggles per clinic per tier, template manager. This is YOUR control panel across all clients.

### Task 3: Clinic Admin Panel — Settings & Configuration
> Build the Clinic Admin panel: manage doctors (add/edit/remove), manage services & prices, set working hours per doctor per day, holidays/closures, manage receptionist accounts, payment settings, booking rules (cancellation policy, advance booking window), WhatsApp notification message templates, patient database view.

### Task 4: Notifications System (WhatsApp + In-App)
> Build the full notification engine: WhatsApp integration (via WhatsApp Business API or Twilio), in-app notifications on dashboard, all triggers (new booking, confirmation, 24h reminder, 2h reminder, cancellation, no-show, prescription ready, new review, payment received, new patient registered). Template-based messages with variable substitution.

### Task 5: Public Website — Template Engine
> Build the public website template system with pages: Home (hero, doctor photo, CTA), Services (list with prices), About Doctor, How to Book, Location + Hours (Google Maps embed), Contact (WhatsApp button, phone, email form), Patient Reviews. Include the Website Editor in Admin panel so clinics can change colors, photos, text without code.

---

## PHASE 2 — Doctor Cabinet / Booking System (Tasks 6–10)

### Task 6: Booking System — Core
> Build the booking heart: specialty selector, doctor selector, service selector, date picker (available days only), time slot picker (free slots only, block taken), patient info form, booking confirmation screen, max capacity per slot, buffer time between consultations, first visit vs return detection, insurance flag.

### Task 7: Booking System — Advanced Features
> Add: cancellation (up to X hours before), reschedule (patient picks new slot), waiting list (join if slot full), emergency slot (doctor opens urgent slot), recurring booking (same slot every week), multi-doctor booking (one patient multiple doctors), online payment / deposit to confirm (optional per clinic).

### Task 8: Patient Portal
> Build full patient portal: register/login (phone + OTP), my appointments (upcoming + past), cancel/reschedule self-service, medical history (past visits + diagnoses), my prescriptions (download PDF), my documents (upload radios, analyses, insurance card), my invoices (download receipts), family members (add wife/kids under one account), notifications view, feedback/rating after consultation.

### Task 9: Doctor Dashboard
> Build doctor dashboard: today's schedule, patient card (full history on click), consultation notes (per visit, private), prescription writer (generate PDF), mark as done / no-show, next available slot view, patient search (by name or phone), stats (patients this week/month), waiting room view (who is waiting), internal chat with receptionist.

### Task 10: Receptionist Dashboard
> Build receptionist dashboard: full booking calendar (all doctors, all slots), manual booking (for phone calls), walk-in registration, check-in (mark patient arrived), waiting room manager (order + estimated wait), one-click call/WhatsApp patient, reschedule tool (drag and drop), daily report (print today's patient list), collect payment (mark paid, amount, method), patient registration form.

---

## PHASE 3 — Analytics & Reports (Task 11)

### Task 11: Analytics & Reports Dashboard
> Build analytics for Admin + Doctor: daily patient count, revenue per day/week/month, most popular services, no-show rate, booking source (online vs walk-in), patient retention rate, busiest hours heatmap, review score over time. Use charts (Chart.js or Recharts).

---

## PHASE 4 — Dentist Extras (Tasks 12–14)

### Task 12: Dentist Booking + Patient Portal Extras
> Extend booking for dentists: treatment type selector (cleaning, filling, implant, braces, extraction), duration-based slots (implant=2h, cleaning=45min), pre-appointment pain questionnaire, sedation flag. Extend patient portal: my treatment plan (what's done, what's next), tooth map (odontogram visual), before/after photos, payment plan tracker, next session reminder.

### Task 13: Dentist Dashboard Extras
> Extend doctor dashboard for dentists: odontogram editor (click tooth → add notes, status, treatment), treatment plan builder (step-by-step per patient), lab orders (send to dental lab, track status), sterilization log, before/after photo upload, material stock alert (low on composite, gloves, etc.).

### Task 14: Installment Payment System
> Build installment system for dentists: enter total treatment cost, set monthly payment schedule, payment tracker (mark each received), auto WhatsApp reminder before payment due date, remaining balance (visible to patient + doctor), PDF receipt per payment.

---

## PHASE 5 — Pharmacy System (Tasks 15–18)

### Task 15: Pharmacy Public Website + Prescription Upload
> Build pharmacy public site: home, product catalog (searchable), services (injections, BP checks), on-duty/garde indicator, contact + map. Build prescription system: patient uploads photo of prescription, pharmacist reviews, ready notification via WhatsApp, partial availability ("3 of 5 ready"), prescription history, refill reminder for chronic meds, delivery option.

### Task 16: Pharmacist Dashboard
> Build pharmacist dashboard: incoming prescription queue, stock checker, order management (order from supplier), daily sales log, expiry tracker (color coded green/yellow/red), stock alerts (low stock), supplier contacts (quick reorder).

### Task 17: Stock Management System
> Build full stock management: product database (all medicines + products), stock levels, minimum stock alert, expiry date tracking, supplier management (multiple per product), purchase orders (create + track), monthly inventory reports.

### Task 18: Loyalty System
> Build loyalty program: points per purchase (1 MAD = 1 point), redeem points for discount, digital loyalty card in patient portal, birthday reward (auto discount), referral bonus (bring a friend = bonus points).

---

## PHASE 6 — Polish & Launch (Tasks 19–20)

### Task 19: Pricing & Tier System
> Implement the tier/pricing logic in Super Admin: Vitrine, Cabinet, Pro, Premium, SaaS Monthly — for all 3 system types (Doctor, Dentist, Pharmacy). Feature toggles per tier. Billing page for clients.

### Task 20: Final QA + Mobile Responsiveness + SEO
> Full responsive design pass across all pages. SEO meta tags for public pages. Performance optimization. Final testing of all flows end-to-end.

---

## How to Send Each Task

When you open a new Devin chat, paste the task description above and add:
1. **Link to your repo** (GitHub/GitLab URL)
2. **Tech stack** you're using (e.g., Next.js, Supabase, Tailwind, etc.)
3. **Which branch** to work from
4. **Any design files** (Figma links, screenshots of your demo)
5. **"Build on top of existing code in [repo]"** so Devin knows not to start from scratch

---

## First Task to Send (Copy-Paste Ready)

```
TASK: Supabase Schema + Auth + Role System

Set up the complete Supabase database schema with these tables:

SHARED TABLES:
- users (id, role, name, phone, email, clinic_id, created_at)
- clinics (id, name, type [doctor/dentist/pharmacy], config jsonb, tier, status, created_at)
- appointments (id, patient_id, doctor_id, clinic_id, service_id, slot_start, slot_end, status, is_first_visit, insurance_flag, source, notes, created_at)
- services (id, clinic_id, name, price, duration_minutes, category)
- time_slots (id, doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes)
- notifications (id, user_id, type, channel, message, sent_at, read_at)
- payments (id, clinic_id, patient_id, appointment_id, amount, method, status, ref, created_at)
- reviews (id, patient_id, clinic_id, stars, comment, response, created_at)
- documents (id, user_id, clinic_id, type, file_url, uploaded_at)
- waiting_list (id, patient_id, doctor_id, clinic_id, service_id, preferred_date, status, created_at)

DOCTOR EXTRAS:
- prescriptions (id, patient_id, doctor_id, appointment_id, content jsonb, pdf_url, created_at)
- consultation_notes (id, patient_id, doctor_id, appointment_id, notes, private, created_at)
- family_members (id, primary_user_id, name, phone, relationship, created_at)

DENTIST EXTRAS:
- odontogram (id, patient_id, tooth_number, status, notes, updated_at)
- treatment_plans (id, patient_id, doctor_id, steps jsonb, status, total_cost, created_at)
- lab_orders (id, doctor_id, patient_id, clinic_id, details, status, created_at)
- installments (id, treatment_plan_id, patient_id, amount, due_date, paid_date, status, receipt_url)
- sterilization_log (id, clinic_id, tool_name, sterilized_at, next_due)

PHARMACY EXTRAS:
- products (id, clinic_id, name, category, price, requires_prescription, barcode)
- stock (id, product_id, clinic_id, quantity, min_threshold, expiry_date, supplier_id)
- prescription_requests (id, patient_id, clinic_id, image_url, status, notes, ready_at)
- loyalty_points (id, patient_id, clinic_id, points, last_updated)
- suppliers (id, clinic_id, name, phone, email, products jsonb)

ALSO:
- Implement Row Level Security (RLS) for 5 roles: super_admin, clinic_admin, receptionist, doctor, patient
- Set up Supabase Auth with phone number + OTP
- Create seed data for testing (1 clinic, 1 doctor, 1 receptionist, 5 patients, sample appointments)

Tech stack: [YOUR STACK]
Repo: [YOUR REPO URL]
Branch: [YOUR BRANCH]
```
