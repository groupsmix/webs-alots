/**
 * Clinic Acquisition Referral Program — server-side library.
 *
 * Distinct from the medical doctor-to-patient referral system in the
 * `referrals` table (migration 00103). This module handles clinic-level
 * acquisition: one clinic refers another to the platform and earns credits
 * when the referred clinic makes their first payment.
 */

import { insertInAppNotification } from "@/lib/notification-persist";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedAdminClient = any;

// ─── Code generation ──────────────────────────────────────────────────────────

const RANDOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omit 0/O, 1/I for clarity

function randomSuffix(length: number): string {
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    result += RANDOM_CHARS[byte % RANDOM_CHARS.length];
  }
  return result;
}

/**
 * Generates a deterministic referral code from clinic prefix + random suffix.
 * Format: "OLTI-{PREFIX3}-{RANDOM6}" e.g. "OLTI-DAR-X7K2M9"
 */
export function generateReferralCode(clinicName: string): string {
  // Normalise: strip diacritics, uppercase, keep only ASCII letters/digits
  const normalised = clinicName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const prefix = normalised.slice(0, 3).padEnd(3, "X");
  const suffix = randomSuffix(6);
  return `OLTI-${prefix}-${suffix}`;
}

// ─── Core functions ────────────────────────────────────────────────────────────

/** Internal helper: insert with up to 5 collision retries. */
async function insertCodeWithRetry(
  supabase: UntypedAdminClient,
  clinicId: string,
  createdBy: string,
  clinicName: string,
): Promise<{ code: string; id: string; discountPct: number; discountMonths: number }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(clinicName);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase
      .from("referral_codes")
      .insert({
        clinic_id: clinicId,
        code,
        created_by: createdBy,
        discount_pct: 10,
        discount_months: 2,
        is_active: true,
      })
      .select("id, code, discount_pct, discount_months")
      .single();

    if (error) {
      const isCollision =
        error.code === "23505" ||
        String(error.message).includes("unique") ||
        String(error.message).includes("duplicate");
      if (isCollision) continue;
      logger.error("Failed to insert referral code", {
        context: "referral-program",
        clinicId,
        error,
      });
      throw new Error("Failed to create referral code");
    }

    const row = data as { id: string; code: string; discount_pct: number; discount_months: number };
    return {
      code: row.code,
      id: row.id,
      discountPct: row.discount_pct,
      discountMonths: row.discount_months,
    };
  }
  throw new Error("Failed to generate a unique referral code after multiple attempts");
}

/**
 * Gets existing referral code for a clinic or creates a new one.
 * Scoped to clinic_id. Returns the code string, id, and discount info.
 */
export async function getOrCreateReferralCode(
  supabase: UntypedAdminClient,
  clinicId: string,
  createdBy: string,
): Promise<{ code: string; id: string; discountPct: number; discountMonths: number }> {
  // Check for existing active code
  const { data: existing, error: fetchError } = await supabase
    .from("referral_codes")
    .select("id, code, discount_pct, discount_months")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    logger.error("Failed to fetch referral code", {
      context: "referral-program",
      clinicId,
      error: fetchError,
    });
    throw new Error("Failed to fetch referral code");
  }

  if (existing) {
    return {
      code: existing.code as string,
      id: existing.id as string,
      discountPct: existing.discount_pct as number,
      discountMonths: existing.discount_months as number,
    };
  }

  // Fetch clinic name for code generation
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    logger.error("Failed to fetch clinic for referral code generation", {
      context: "referral-program",
      clinicId,
      error: clinicError,
    });
    throw new Error("Failed to fetch clinic");
  }

  // Generate a unique code (retry up to 5 times on collision)
  return await insertCodeWithRetry(supabase, clinicId, createdBy, clinic.name as string);
}

/**
 * Called when a new clinic signs up with a referral code.
 * - Validates code exists and is active + not expired + under max_uses
 * - Records a referral_events row (signup)
 * - Increments times_used on referral_codes
 * - Returns discount info to apply to the new clinic's first payment
 */
export async function applyReferralCode(
  supabase: UntypedAdminClient,
  code: string,
  refereeClinicId: string,
): Promise<{ discountPct: number; discountMonths: number; referrerClinicId: string } | null> {
  const now = new Date().toISOString();

  // Fetch the code with validation in a single query
  const { data: referralCode, error: codeError } = await supabase
    .from("referral_codes")
    .select(
      "id, clinic_id, discount_pct, discount_months, is_active, times_used, max_uses, expires_at",
    )
    .eq("code", code)
    .single();

  if (codeError || !referralCode) {
    logger.warn("Referral code not found", { context: "referral-program", code });
    return null;
  }

  // Validate the code is usable
  if (!referralCode.is_active) {
    logger.warn("Referral code is inactive", { context: "referral-program", code });
    return null;
  }

  if (referralCode.expires_at && referralCode.expires_at < now) {
    logger.warn("Referral code has expired", { context: "referral-program", code });
    return null;
  }

  if (
    referralCode.max_uses !== null &&
    referralCode.max_uses !== undefined &&
    (referralCode.times_used as number) >= (referralCode.max_uses as number)
  ) {
    logger.warn("Referral code max uses reached", { context: "referral-program", code });
    return null;
  }

  // Prevent self-referral
  if ((referralCode.clinic_id as string) === refereeClinicId) {
    logger.warn("Self-referral attempt blocked", {
      context: "referral-program",
      clinicId: refereeClinicId,
    });
    return null;
  }

  // Check the referee hasn't already used a referral code
  const { data: existingEvent } = await supabase
    .from("referral_events")
    .select("id")
    .eq("referee_clinic_id", refereeClinicId)
    .eq("event_type", "signup")
    .maybeSingle();

  if (existingEvent) {
    logger.warn("Referee clinic already has a referral signup event", {
      context: "referral-program",
      refereeClinicId,
    });
    return null;
  }

  // Record signup event
  const { error: eventError } = await supabase.from("referral_events").insert({
    referral_code_id: referralCode.id,
    referrer_clinic_id: referralCode.clinic_id,
    referee_clinic_id: refereeClinicId,
    event_type: "signup",
  });

  if (eventError) {
    logger.error("Failed to record referral signup event", {
      context: "referral-program",
      code,
      refereeClinicId,
      error: eventError,
    });
    throw new Error("Failed to record referral event");
  }

  // Increment times_used
  const { error: updateError } = await supabase
    .from("referral_codes")
    .update({ times_used: (referralCode.times_used as number) + 1 })
    .eq("id", referralCode.id);

  if (updateError) {
    // Non-fatal: log but don't block the signup
    logger.error("Failed to increment referral code times_used", {
      context: "referral-program",
      code,
      error: updateError,
    });
  }

  return {
    discountPct: referralCode.discount_pct as number,
    discountMonths: referralCode.discount_months as number,
    referrerClinicId: referralCode.clinic_id as string,
  };
}

/**
 * Called after a referred clinic makes their first payment.
 * - Finds the referral_events row for this clinic (signup)
 * - Creates a referral_events row (first_payment)
 * - Creates a referral_credits row for the referrer
 * - Sends in-app notification to a clinic_admin of the referrer
 */
export async function triggerReferralReward(
  supabase: UntypedAdminClient,
  refereeClinicId: string,
  rewardCentimes: number,
): Promise<void> {
  // Find the signup event for this referee
  const { data: signupEvent, error: eventError } = await supabase
    .from("referral_events")
    .select("id, referral_code_id, referrer_clinic_id")
    .eq("referee_clinic_id", refereeClinicId)
    .eq("event_type", "signup")
    .maybeSingle();

  if (eventError || !signupEvent) {
    logger.warn("No signup event found for referee clinic — skipping reward", {
      context: "referral-program",
      refereeClinicId,
      error: eventError,
    });
    return;
  }

  const referrerClinicId = signupEvent.referrer_clinic_id as string;

  // Avoid double-rewarding: check if first_payment event already exists
  const { data: existingPayment } = await supabase
    .from("referral_events")
    .select("id")
    .eq("referee_clinic_id", refereeClinicId)
    .eq("event_type", "first_payment")
    .maybeSingle();

  if (existingPayment) {
    logger.info("Referral reward already triggered for referee clinic — skipping", {
      context: "referral-program",
      refereeClinicId,
    });
    return;
  }

  // Record first_payment event
  const { data: paymentEvent, error: paymentEventError } = await supabase
    .from("referral_events")
    .insert({
      referral_code_id: signupEvent.referral_code_id,
      referrer_clinic_id: referrerClinicId,
      referee_clinic_id: refereeClinicId,
      event_type: "first_payment",
    })
    .select("id")
    .single();

  if (paymentEventError || !paymentEvent) {
    logger.error("Failed to record first_payment referral event", {
      context: "referral-program",
      refereeClinicId,
      error: paymentEventError,
    });
    return;
  }

  // Create credit for the referrer
  const { error: creditError } = await supabase.from("referral_credits").insert({
    referral_event_id: paymentEvent.id,
    beneficiary_clinic_id: referrerClinicId,
    amount_centimes: rewardCentimes,
    currency: "MAD",
    payout_type: "account_credit",
    status: "pending",
  });

  if (creditError) {
    logger.error("Failed to create referral credit", {
      context: "referral-program",
      referrerClinicId,
      rewardCentimes,
      error: creditError,
    });
    return;
  }

  // Find a clinic_admin user for the referrer to notify
  const { data: adminUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", referrerClinicId)
    .eq("role", "clinic_admin")
    .limit(1)
    .maybeSingle();

  if (userError || !adminUser) {
    logger.warn("No clinic_admin found for referrer — skipping notification", {
      context: "referral-program",
      referrerClinicId,
      error: userError,
    });
    return;
  }

  // Send in-app notification
  const rewardMad = (rewardCentimes / 100).toFixed(2);
  await insertInAppNotification({
    userId: adminUser.id as string,
    trigger: "payment_received",
    title: "Récompense de parrainage débloquée",
    message: `Votre filleule a effectué son premier paiement. Vous avez gagné ${rewardMad} MAD de crédit.`,
  });
}
