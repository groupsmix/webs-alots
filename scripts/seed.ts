/**
 * Database Seeding Script — Oltigo Health
 *
 * Populates demo data for all 5 roles with realistic Moroccan clinic data.
 * Usage: npm run seed
 *
 * Requires POSTGRES_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * to be set in .env.local or environment.
 *
 * SECURITY: Uses well-known passwords — seed users are blocked in production
 * by the 3-layer seed-guard (see src/lib/seed-guard.ts).
 */

import { createClient } from "@supabase/supabase-js";

// ── Configuration ──────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is required.\n" +
      "Set it in .env.local or pass via environment.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Deterministic UUIDs ────────────────────────────────────────────

const CLINIC_IDS = {
  drAhmed: "00000000-0000-0000-0000-000000000001",
  sourireDental: "00000000-0000-0000-0000-000000000002",
  pharmacieCentrale: "00000000-0000-0000-0000-000000000003",
  polycliniqueAtlas: "00000000-0000-0000-0000-000000000004",
  labBioMaroc: "00000000-0000-0000-0000-000000000005",
} as const;

const USER_IDS = {
  superAdmin: "00000000-0000-0000-1000-000000000001",
  clinicAdmin: "00000000-0000-0000-1000-000000000002",
  doctor: "00000000-0000-0000-1000-000000000003",
  receptionist: "00000000-0000-0000-1000-000000000004",
  patient1: "00000000-0000-0000-1000-000000000005",
  patient2: "00000000-0000-0000-1000-000000000006",
  doctor2: "00000000-0000-0000-1000-000000000007",
  dentist: "00000000-0000-0000-1000-000000000008",
  pharmacist: "00000000-0000-0000-1000-000000000009",
  labTech: "00000000-0000-0000-1000-000000000010",
} as const;

const SERVICE_IDS = {
  consultationGenerale: "00000000-0000-0000-2000-000000000001",
  suiviChronique: "00000000-0000-0000-2000-000000000002",
  detartrage: "00000000-0000-0000-2000-000000000003",
  blanchiment: "00000000-0000-0000-2000-000000000004",
  echoAbdominale: "00000000-0000-0000-2000-000000000005",
  bilanSanguin: "00000000-0000-0000-2000-000000000006",
  consultationUrgente: "00000000-0000-0000-2000-000000000007",
  suiviGrossesse: "00000000-0000-0000-2000-000000000008",
} as const;

// ── Seed Data ──────────────────────────────────────────────────────

async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    if (error.message?.includes("already been registered")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (existing) return existing.id;
    }
    throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  }
  return data.user.id;
}

async function seedClinics() {
  console.log("Seeding clinics...");
  const clinics = [
    {
      id: CLINIC_IDS.drAhmed,
      name: "Cabinet Dr. Ahmed Benali",
      subdomain: "dr-ahmed",
      clinic_type: "general_practitioner",
      tier: "pro",
      is_active: true,
      settings: {
        primary_color: "#2563eb",
        secondary_color: "#1e40af",
        timezone: "Africa/Casablanca",
        currency: "MAD",
        languages: ["fr", "ar"],
        ramadan_mode: false,
      },
    },
    {
      id: CLINIC_IDS.sourireDental,
      name: "Clinique Dentaire Sourire de Casablanca",
      subdomain: "sourire-dental",
      clinic_type: "dentist",
      tier: "pro",
      is_active: true,
      settings: {
        primary_color: "#0891b2",
        secondary_color: "#0e7490",
        timezone: "Africa/Casablanca",
        currency: "MAD",
        languages: ["fr", "ar"],
      },
    },
    {
      id: CLINIC_IDS.pharmacieCentrale,
      name: "Pharmacie Centrale Rabat",
      subdomain: "pharmacie-centrale",
      clinic_type: "pharmacy",
      tier: "cabinet",
      is_active: true,
      settings: {
        primary_color: "#16a34a",
        secondary_color: "#15803d",
        timezone: "Africa/Casablanca",
        currency: "MAD",
        languages: ["fr", "ar"],
      },
    },
    {
      id: CLINIC_IDS.polycliniqueAtlas,
      name: "Polyclinique Atlas Marrakech",
      subdomain: "atlas-polyclinique",
      clinic_type: "polyclinic",
      tier: "premium",
      is_active: true,
      settings: {
        primary_color: "#7c3aed",
        secondary_color: "#6d28d9",
        timezone: "Africa/Casablanca",
        currency: "MAD",
        languages: ["fr", "ar", "en"],
      },
    },
    {
      id: CLINIC_IDS.labBioMaroc,
      name: "Laboratoire Bio Maroc - Fès",
      subdomain: "bio-maroc-lab",
      clinic_type: "analysis_lab",
      tier: "cabinet",
      is_active: true,
      settings: {
        primary_color: "#ea580c",
        secondary_color: "#c2410c",
        timezone: "Africa/Casablanca",
        currency: "MAD",
        languages: ["fr", "ar"],
      },
    },
  ];

  const { error } = await supabase.from("clinics").upsert(clinics, { onConflict: "id" });
  if (error) throw new Error(`Clinics seed failed: ${error.message}`);
  console.log(`  ✓ ${clinics.length} clinics seeded`);
}

async function seedUsers() {
  console.log("Seeding auth + profile users...");

  const accounts = [
    {
      email: "super@oltigo.test",
      password: "SuperAdmin123!",
      profile: {
        id: USER_IDS.superAdmin,
        role: "super_admin",
        name: "Rachid Tazi",
        phone: "+212600000001",
        email: "super@oltigo.test",
        clinic_id: null,
      },
    },
    {
      email: "admin@dr-ahmed.test",
      password: "ClinicAdmin123!",
      profile: {
        id: USER_IDS.clinicAdmin,
        role: "clinic_admin",
        name: "Amina El Fassi",
        phone: "+212661234567",
        email: "admin@dr-ahmed.test",
        clinic_id: CLINIC_IDS.drAhmed,
      },
    },
    {
      email: "doctor@dr-ahmed.test",
      password: "Doctor123!",
      profile: {
        id: USER_IDS.doctor,
        role: "doctor",
        name: "Dr. Ahmed Benali",
        phone: "+212662345678",
        email: "doctor@dr-ahmed.test",
        clinic_id: CLINIC_IDS.drAhmed,
      },
    },
    {
      email: "reception@dr-ahmed.test",
      password: "Reception123!",
      profile: {
        id: USER_IDS.receptionist,
        role: "receptionist",
        name: "Hanane Berrada",
        phone: "+212663456789",
        email: "reception@dr-ahmed.test",
        clinic_id: CLINIC_IDS.drAhmed,
      },
    },
    {
      email: "patient1@test.test",
      password: "Patient123!",
      profile: {
        id: USER_IDS.patient1,
        role: "patient",
        name: "Fatima Zahra El Amrani",
        phone: "+212664567890",
        email: "patient1@test.test",
        clinic_id: CLINIC_IDS.drAhmed,
      },
    },
    {
      email: "patient2@test.test",
      password: "Patient123!",
      profile: {
        id: USER_IDS.patient2,
        role: "patient",
        name: "Youssef Mansouri",
        phone: "+212665678901",
        email: "patient2@test.test",
        clinic_id: CLINIC_IDS.drAhmed,
      },
    },
    {
      email: "doctor@sourire-dental.test",
      password: "Dentist123!",
      profile: {
        id: USER_IDS.dentist,
        role: "doctor",
        name: "Dr. Nadia Cherkaoui",
        phone: "+212666789012",
        email: "doctor@sourire-dental.test",
        clinic_id: CLINIC_IDS.sourireDental,
      },
    },
    {
      email: "pharmacist@pharmacie-centrale.test",
      password: "Pharmacist123!",
      profile: {
        id: USER_IDS.pharmacist,
        role: "clinic_admin",
        name: "Omar Hajji",
        phone: "+212667890123",
        email: "pharmacist@pharmacie-centrale.test",
        clinic_id: CLINIC_IDS.pharmacieCentrale,
      },
    },
    {
      email: "doctor2@atlas.test",
      password: "Doctor123!",
      profile: {
        id: USER_IDS.doctor2,
        role: "doctor",
        name: "Dr. Karim Idrissi",
        phone: "+212668901234",
        email: "doctor2@atlas.test",
        clinic_id: CLINIC_IDS.polycliniqueAtlas,
      },
    },
    {
      email: "lab@bio-maroc.test",
      password: "LabTech123!",
      profile: {
        id: USER_IDS.labTech,
        role: "clinic_admin",
        name: "Saida Alaoui",
        phone: "+212669012345",
        email: "lab@bio-maroc.test",
        clinic_id: CLINIC_IDS.labBioMaroc,
      },
    },
  ];

  for (const account of accounts) {
    const authId = await createAuthUser(account.email, account.password);
    const { error } = await supabase
      .from("users")
      .upsert({ ...account.profile, auth_id: authId }, { onConflict: "id" });
    if (error) throw new Error(`User ${account.email} profile seed failed: ${error.message}`);
  }
  console.log(`  ✓ ${accounts.length} users seeded`);
}

async function seedServices() {
  console.log("Seeding services...");
  const services = [
    {
      id: SERVICE_IDS.consultationGenerale,
      clinic_id: CLINIC_IDS.drAhmed,
      name: "Consultation générale",
      description: "Consultation médicale générale avec examen clinique",
      duration_minutes: 30,
      price: 200.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.suiviChronique,
      clinic_id: CLINIC_IDS.drAhmed,
      name: "Suivi maladie chronique",
      description: "Suivi diabète, hypertension, thyroïde — contrôle et ajustement traitement",
      duration_minutes: 20,
      price: 150.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.consultationUrgente,
      clinic_id: CLINIC_IDS.drAhmed,
      name: "Consultation urgente",
      description: "Consultation sans rendez-vous pour urgences mineures",
      duration_minutes: 15,
      price: 250.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.detartrage,
      clinic_id: CLINIC_IDS.sourireDental,
      name: "Détartrage",
      description: "Nettoyage dentaire professionnel avec ultrasons",
      duration_minutes: 45,
      price: 300.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.blanchiment,
      clinic_id: CLINIC_IDS.sourireDental,
      name: "Blanchiment dentaire",
      description: "Blanchiment professionnel au peroxyde — résultats visibles en 1 séance",
      duration_minutes: 60,
      price: 1500.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.echoAbdominale,
      clinic_id: CLINIC_IDS.polycliniqueAtlas,
      name: "Échographie abdominale",
      description: "Échographie abdominale complète avec compte-rendu",
      duration_minutes: 30,
      price: 400.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.bilanSanguin,
      clinic_id: CLINIC_IDS.labBioMaroc,
      name: "Bilan sanguin complet",
      description: "NFS, glycémie, bilan lipidique, bilan hépatique, créatinine",
      duration_minutes: 15,
      price: 350.0,
      is_active: true,
    },
    {
      id: SERVICE_IDS.suiviGrossesse,
      clinic_id: CLINIC_IDS.polycliniqueAtlas,
      name: "Suivi de grossesse",
      description: "Consultation prénatale avec échographie",
      duration_minutes: 45,
      price: 500.0,
      is_active: true,
    },
  ];

  const { error } = await supabase.from("services").upsert(services, { onConflict: "id" });
  if (error) throw new Error(`Services seed failed: ${error.message}`);
  console.log(`  ✓ ${services.length} services seeded`);
}

async function seedTimeSlots() {
  console.log("Seeding time slots...");
  const slots = [];

  // Dr. Ahmed: Mon-Fri, 09:00-12:30 + 14:00-18:00
  for (let day = 1; day <= 5; day++) {
    slots.push(
      {
        doctor_id: USER_IDS.doctor,
        clinic_id: CLINIC_IDS.drAhmed,
        day_of_week: day,
        start_time: "09:00",
        end_time: "12:30",
        is_available: true,
      },
      {
        doctor_id: USER_IDS.doctor,
        clinic_id: CLINIC_IDS.drAhmed,
        day_of_week: day,
        start_time: "14:00",
        end_time: "18:00",
        is_available: true,
      },
    );
  }

  // Dr. Cherkaoui (dentist): Mon-Sat, 10:00-13:00 + 15:00-19:00
  for (let day = 1; day <= 6; day++) {
    slots.push(
      {
        doctor_id: USER_IDS.dentist,
        clinic_id: CLINIC_IDS.sourireDental,
        day_of_week: day,
        start_time: "10:00",
        end_time: "13:00",
        is_available: true,
      },
      {
        doctor_id: USER_IDS.dentist,
        clinic_id: CLINIC_IDS.sourireDental,
        day_of_week: day,
        start_time: "15:00",
        end_time: "19:00",
        is_available: true,
      },
    );
  }

  // Dr. Idrissi (polyclinic): Mon-Fri, 08:30-12:00 + 14:30-17:30
  for (let day = 1; day <= 5; day++) {
    slots.push(
      {
        doctor_id: USER_IDS.doctor2,
        clinic_id: CLINIC_IDS.polycliniqueAtlas,
        day_of_week: day,
        start_time: "08:30",
        end_time: "12:00",
        is_available: true,
      },
      {
        doctor_id: USER_IDS.doctor2,
        clinic_id: CLINIC_IDS.polycliniqueAtlas,
        day_of_week: day,
        start_time: "14:30",
        end_time: "17:30",
        is_available: true,
      },
    );
  }

  // Delete existing seed slots first to avoid duplicates
  for (const doctorId of [USER_IDS.doctor, USER_IDS.dentist, USER_IDS.doctor2]) {
    await supabase.from("time_slots").delete().eq("doctor_id", doctorId);
  }

  const { error } = await supabase.from("time_slots").insert(slots);
  if (error) throw new Error(`Time slots seed failed: ${error.message}`);
  console.log(`  ✓ ${slots.length} time slots seeded`);
}

async function seedAppointments() {
  console.log("Seeding appointments...");
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const appointments = [
    {
      patient_id: USER_IDS.patient1,
      doctor_id: USER_IDS.doctor,
      clinic_id: CLINIC_IDS.drAhmed,
      service_id: SERVICE_IDS.consultationGenerale,
      slot_start: new Date(tomorrow.getTime()).toISOString(),
      slot_end: new Date(tomorrow.getTime() + 30 * 60 * 1000).toISOString(),
      status: "confirmed",
      is_first_visit: false,
      insurance_flag: true,
      source: "online",
      notes: "Suivi tension artérielle — apporter résultats analyses",
    },
    {
      patient_id: USER_IDS.patient2,
      doctor_id: USER_IDS.doctor,
      clinic_id: CLINIC_IDS.drAhmed,
      service_id: SERVICE_IDS.suiviChronique,
      slot_start: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
      slot_end: new Date(tomorrow.getTime() + 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
      status: "pending",
      is_first_visit: true,
      insurance_flag: false,
      source: "whatsapp",
      notes: "Nouveau patient — diabète type 2",
    },
    {
      patient_id: USER_IDS.patient1,
      doctor_id: USER_IDS.dentist,
      clinic_id: CLINIC_IDS.sourireDental,
      service_id: SERVICE_IDS.detartrage,
      slot_start: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      slot_end: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      status: "confirmed",
      is_first_visit: false,
      insurance_flag: true,
      source: "phone",
    },
    {
      patient_id: USER_IDS.patient2,
      doctor_id: USER_IDS.doctor2,
      clinic_id: CLINIC_IDS.polycliniqueAtlas,
      service_id: SERVICE_IDS.echoAbdominale,
      slot_start: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      slot_end: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      status: "pending",
      is_first_visit: true,
      insurance_flag: false,
      source: "online",
      notes: "Douleurs abdominales récurrentes",
    },
  ];

  // Delete existing seed appointments to avoid duplicates
  for (const clinicId of Object.values(CLINIC_IDS)) {
    await supabase
      .from("appointments")
      .delete()
      .eq("clinic_id", clinicId)
      .in("patient_id", [USER_IDS.patient1, USER_IDS.patient2]);
  }

  const { error } = await supabase.from("appointments").insert(appointments);
  if (error) throw new Error(`Appointments seed failed: ${error.message}`);
  console.log(`  ✓ ${appointments.length} appointments seeded`);
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log(" Oltigo Health — Database Seeder");
  console.log("═══════════════════════════════════════════════");
  console.log(`Target: ${SUPABASE_URL}\n`);

  try {
    await seedClinics();
    await seedUsers();
    await seedServices();
    await seedTimeSlots();
    await seedAppointments();

    console.log("\n═══════════════════════════════════════════════");
    console.log(" Seeding complete!");
    console.log("═══════════════════════════════════════════════");
    console.log("\nTest accounts:");
    console.log("  super@oltigo.test        / SuperAdmin123!   → super_admin");
    console.log("  admin@dr-ahmed.test      / ClinicAdmin123!  → clinic_admin (Dr. Ahmed)");
    console.log("  doctor@dr-ahmed.test     / Doctor123!       → doctor (Dr. Ahmed)");
    console.log("  reception@dr-ahmed.test  / Reception123!    → receptionist (Dr. Ahmed)");
    console.log("  patient1@test.test       / Patient123!      → patient");
    console.log("  patient2@test.test       / Patient123!      → patient");
    console.log("  doctor@sourire-dental.test / Dentist123!    → doctor (Sourire Dental)");
    console.log("  pharmacist@pharmacie-centrale.test / Pharmacist123! → clinic_admin (Pharmacie)");
    console.log("  doctor2@atlas.test       / Doctor123!       → doctor (Atlas Polyclinique)");
    console.log("  lab@bio-maroc.test       / LabTech123!      → clinic_admin (Bio Maroc Lab)");
    console.log("\nSubdomains:");
    console.log("  http://dr-ahmed.localhost:3000");
    console.log("  http://sourire-dental.localhost:3000");
    console.log("  http://pharmacie-centrale.localhost:3000");
    console.log("  http://atlas-polyclinique.localhost:3000");
    console.log("  http://bio-maroc-lab.localhost:3000");
  } catch (err) {
    console.error("\nSeeding failed:", err);
    process.exit(1);
  }
}

main();
