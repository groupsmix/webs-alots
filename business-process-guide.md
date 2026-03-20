# How to Sell & Customize Sites — Your Complete Business Process

## Your Business Model (Summary)

You have **ONE codebase** that you deploy **many times** — once per client (doctor, dentist, or pharmacy). All clients share **ONE Supabase database**, isolated by `clinic_id` using Row Level Security (RLS). Each client gets their own website on Cloudflare Pages.

**Your cost:** ~$5/month for ALL clients
**You charge each client:** 5,000-20,000 MAD setup + 500-1,000 MAD/month

---

## STEP-BY-STEP: How to Sell a New Site

### PHASE 1: Sign the Client (Sales)

1. Meet the doctor/dentist/pharmacist
2. Show them the demo site: https://webs-alots.pages.dev
3. Pick their tier:

| Tier | Price MAD | What They Get |
|------|-----------|---------------|
| **Vitrine** | 2,500-3,000 | Public website only (no booking, no portal) |
| **Cabinet** | 6,000-8,000 | + Booking system + Receptionist dashboard |
| **Pro** | 12,000-15,000 | + Patient portal + Doctor dashboard + Analytics |
| **Premium** | 20,000-25,000 | + Prescriptions + Documents + Multi-doctor |
| **SaaS Monthly** | 500-1,000/month | Everything hosted + maintained + updates |

4. Collect their info:
   - Clinic name, doctor name, specialty
   - Phone, WhatsApp, email, address
   - Working hours (per day)
   - Services they offer + prices
   - Doctor photo, logo (if they have one)
   - Domain name they want (e.g., `dr-ahmed.ma`)

---

### PHASE 2: Set Up the Database (5 minutes)

You do this **once** in your Supabase project. All clients share the same database.

#### 2.1 — Add the Clinic to Supabase

Go to your Supabase dashboard → SQL Editor, and run:

```sql
-- Create the new clinic
INSERT INTO clinics (id, name, type, config, tier, status)
VALUES (
  gen_random_uuid(),         -- auto-generates unique ID
  'Cabinet Dr. Sara Tazi',   -- client's clinic name
  'doctor',                  -- 'doctor', 'dentist', or 'pharmacy'
  '{
    "locale": "fr",
    "currency": "MAD",
    "city": "Rabat",
    "phone": "+212 5 37 XX XX XX",
    "specialty": "Dermatology"
  }'::jsonb,
  'pro',                     -- their tier
  'active'
);
```

**Copy the generated `id`** — you'll need it. To find it:
```sql
SELECT id, name FROM clinics ORDER BY created_at DESC LIMIT 1;
```

#### 2.2 — Add the Doctor/Admin User

```sql
-- Add the doctor (the clinic owner)
INSERT INTO users (id, role, name, phone, email, clinic_id)
VALUES (
  gen_random_uuid(),
  'clinic_admin',                              -- they are both admin and doctor
  'Dr. Sara Tazi',
  '+212611XXXXXX',
  'sara@dr-tazi.ma',
  'PASTE_CLINIC_ID_HERE'                       -- the clinic ID from step 2.1
);

-- Add the receptionist
INSERT INTO users (id, role, name, phone, email, clinic_id)
VALUES (
  gen_random_uuid(),
  'receptionist',
  'Hanane Belkadi',
  '+212622XXXXXX',
  'hanane@dr-tazi.ma',
  'PASTE_CLINIC_ID_HERE'
);
```

#### 2.3 — Add Their Services

```sql
INSERT INTO services (clinic_id, name, price, duration_minutes, category)
VALUES
  ('PASTE_CLINIC_ID_HERE', 'Consultation Dermatologique', 400.00, 30, 'consultation'),
  ('PASTE_CLINIC_ID_HERE', 'Traitement Acne', 600.00, 45, 'treatment'),
  ('PASTE_CLINIC_ID_HERE', 'Visite de Controle', 250.00, 20, 'follow-up');
```

#### 2.4 — Add Their Time Slots

```sql
-- Monday to Friday, 9:00-12:00 and 14:00-17:00
INSERT INTO time_slots (doctor_id, clinic_id, day_of_week, start_time, end_time, is_available, max_capacity, buffer_minutes)
VALUES
  ('DOCTOR_USER_ID', 'CLINIC_ID', 1, '09:00', '12:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 1, '14:00', '17:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 2, '09:00', '12:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 2, '14:00', '17:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 3, '09:00', '12:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 3, '14:00', '17:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 4, '09:00', '12:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 4, '14:00', '17:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 5, '09:00', '12:00', TRUE, 1, 10),
  ('DOCTOR_USER_ID', 'CLINIC_ID', 5, '14:00', '17:00', TRUE, 1, 10);
```

---

### PHASE 3: Customize the Website (10-15 minutes)

You only change **3 files** to customize a client's site. Everything else stays the same.

#### 3.1 — Edit `src/config/clinic.config.ts`

This is the **main config file**. Change these values:

```typescript
export const clinicConfig: ClinicConfig = {
  clinicId: "PASTE_CLINIC_ID_FROM_SUPABASE",  // <-- from Phase 2
  name: "Cabinet Dr. Sara Tazi",               // <-- client name
  type: "doctor",                              // <-- "doctor", "dentist", or "pharmacy"
  tier: "pro",                                 // <-- their plan tier
  domain: "dr-tazi.ma",                        // <-- their domain
  locale: "fr",                                // <-- "fr", "ar", or "en"
  currency: "MAD",

  contact: {
    phone: "+212 5 37 XX XX XX",
    whatsapp: "+212 6 11 XX XX XX",
    email: "contact@dr-tazi.ma",
    address: "45 Avenue Hassan II, Rabat",
    city: "Rabat",
    googleMapsUrl: "https://maps.google.com/...",
  },

  workingHours: {
    0: { open: "09:00", close: "17:00", enabled: false }, // Sunday - closed
    1: { open: "09:00", close: "17:00", enabled: true },  // Monday
    2: { open: "09:00", close: "17:00", enabled: true },  // Tuesday
    3: { open: "09:00", close: "17:00", enabled: true },  // Wednesday
    4: { open: "09:00", close: "17:00", enabled: true },  // Thursday
    5: { open: "09:00", close: "17:00", enabled: true },  // Friday
    6: { open: "09:00", close: "13:00", enabled: true },  // Saturday - half day
  },

  booking: {
    slotDuration: 30,        // minutes per appointment
    bufferTime: 10,          // gap between appointments
    maxAdvanceDays: 30,      // how far ahead they can book
    maxPerSlot: 1,           // max patients per slot
    cancellationHours: 24,   // min hours before to cancel
    maxRecurringWeeks: 12,
  },

  // Turn features ON/OFF based on their tier:
  features: {
    booking: true,                    // Vitrine = false, all others = true
    patientPortal: true,              // Pro and above
    doctorDashboard: true,            // Pro and above
    receptionistDashboard: true,      // Cabinet and above
    prescriptions: false,             // Premium only
    documents: false,                 // Premium only
    analytics: true,                  // Pro and above
    multiDoctor: false,               // Premium only
    onlinePayment: false,             // Optional add-on
    whatsappNotifications: false,     // Optional add-on
    waitingList: true,
    emergencySlots: true,
    recurringBookings: true,
  },
};
```

#### 3.2 — Edit `src/config/theme.config.ts`

Change colors and branding:

```typescript
export const themeConfig: ThemeConfig = {
  primaryColor: "#2C7A51",        // <-- client's brand color
  secondaryColor: "#1E4DA1",      // <-- accent color
  logoPath: "/logo.svg",          // <-- put their logo in /public/logo.svg
  faviconPath: "/favicon.ico",
  headingFont: "Geist",
  bodyFont: "Geist",
  heroImagePath: "/hero-bg.jpg",  // <-- optional hero background
};
```

#### 3.3 — Edit `src/lib/website-config.ts`

Change ALL the website text content:

```typescript
export const defaultWebsiteConfig: WebsiteConfig = {
  hero: {
    title: "Dr. Sara Tazi — Dermatologue",
    subtitle: "Soins dermatologiques professionnels a Rabat...",
    ctaPrimary: "Prendre Rendez-vous",
    ctaSecondary: "Nos Services",
  },
  about: {
    doctorName: "Dr. Sara Tazi",
    specialty: "Dermatologie",
    bio: "Specialiste en dermatologie avec 10 ans d'experience...",
    // ... fill in all their details
  },
  contact: {
    phone: "+212 5 37 XX XX XX",
    whatsapp: "+212 6 11 XX XX XX",
    email: "contact@dr-tazi.ma",
    address: "45 Avenue Hassan II, Rabat",
    // ...
  },
  // ... update location, working hours text, etc.
};
```

#### 3.4 — Add Their Images

Put their files in the `/public/` folder:
- `/public/logo.svg` — their logo
- `/public/hero-bg.jpg` — hero background image (optional)
- `/public/doctor-photo.jpg` — doctor's photo

---

### PHASE 4: Deploy to Cloudflare Pages (5 minutes)

#### Option A: New Cloudflare Pages Project (Recommended for each client)

1. Go to Cloudflare Dashboard → Pages → Create Project
2. Connect to GitHub → select your `webs-alots` repo
3. **Create a new branch for this client first:**

```bash
git checkout -b client/dr-sara-tazi
# Make your config changes from Phase 3
git add src/config/ src/lib/website-config.ts public/
git commit -m "Configure site for Dr. Sara Tazi"
git push origin client/dr-sara-tazi
```

4. In Cloudflare Pages setup:
   - **Project name:** `dr-sara-tazi`
   - **Production branch:** `client/dr-sara-tazi`
   - **Build command:** `npm run build`
   - **Output directory:** `.worker-next/assets`
   - **Environment variables:**
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
     - `NODE_VERSION` = `20`

5. Click Deploy!

#### Option B: Custom Domain

After the site is live on `dr-sara-tazi.pages.dev`:

1. In Cloudflare Pages → Custom Domains → Add `dr-tazi.ma`
2. Update DNS to point to Cloudflare
3. SSL is automatic and free

---

### PHASE 5: Hand Over to Client (5 minutes)

1. Send them their site URL
2. They log in with their phone number (OTP via SMS)
3. They see their dashboard based on their role
4. Train them (15-minute WhatsApp call):
   - How to view appointments
   - How the receptionist uses the booking calendar
   - How patients book online

---

## QUICK REFERENCE: What Changes Per Client

| What | Where | Example |
|------|-------|---------|
| Clinic name, type, tier | `src/config/clinic.config.ts` | "Cabinet Dr. Sara" |
| Contact info | `src/config/clinic.config.ts` | Phone, email, address |
| Working hours | `src/config/clinic.config.ts` | Mon-Fri 9-17 |
| Feature flags | `src/config/clinic.config.ts` | booking: true/false |
| Colors & logo | `src/config/theme.config.ts` | primaryColor: "#2C7A51" |
| Website text | `src/lib/website-config.ts` | Hero title, about, etc. |
| Doctor photo | `/public/doctor-photo.jpg` | Physical file |
| Logo | `/public/logo.svg` | Physical file |
| DB data | Supabase SQL Editor | clinic, users, services |
| Domain | Cloudflare Pages dashboard | dr-tazi.ma |

---

## TIME PER NEW CLIENT

| Step | Time |
|------|------|
| Add clinic to Supabase (SQL) | 5 min |
| Edit 3 config files | 10-15 min |
| Add images to /public/ | 2 min |
| Create branch + push | 2 min |
| Create Cloudflare Pages project | 5 min |
| Add custom domain | 2 min |
| **Total** | **~30 minutes** |

---

## YOUR WORKFLOW SUMMARY

```
NEW CLIENT SIGNS UP
        |
        v
[1] Add clinic + users + services to Supabase (SQL)
        |
        v
[2] Create new git branch: client/dr-name
        |
        v
[3] Edit 3 files:
    - clinic.config.ts    (name, contact, features)
    - theme.config.ts     (colors, logo)
    - website-config.ts   (all text content)
        |
        v
[4] Add their images to /public/
        |
        v
[5] git commit + push to branch
        |
        v
[6] Create Cloudflare Pages project
    (point to their branch, add env vars)
        |
        v
[7] Add custom domain (dr-name.ma)
        |
        v
[8] Send them the URL + train them
        |
        v
DONE — Collect 500-1,000 MAD/month forever
```

---

## SCALING: When You Have 50+ Clients

Right now, each client = 1 branch + 1 Cloudflare Pages project. This works great for up to ~50 clients. When you scale beyond that, you can evolve to:

1. **Dynamic routing** — One deployment that reads `clinic_id` from the domain/subdomain, so you don't need separate branches
2. **Admin panel for onboarding** — Instead of editing config files, you fill a form in your Super Admin panel that saves to Supabase and auto-generates the site
3. **Automated deployments** — A script that creates the Cloudflare Pages project + sets env vars via API (which I already did for your main project!)

But for now, the branch-per-client approach is simple, proven, and fast.
