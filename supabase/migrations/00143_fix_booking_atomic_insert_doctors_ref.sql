-- Fix: booking_atomic_insert references non-existent `doctors` table
--
-- Migration 00074 was written with `SELECT 1 FROM doctors WHERE ...` to validate
-- that the supplied doctor_id belongs to the supplied clinic. No `doctors` table
-- exists — doctors are stored in the `users` table with role = 'doctor' (or other
-- clinical roles). The broken reference caused the function to throw
-- "relation 'doctors' does not exist" instead of the expected INVALID_TENANT error,
-- which in turn broke the pgTAP cross-tenant validation tests (A2-03).
--
-- This migration replaces the function with an identical body except the
-- doctor-validation sub-select now queries `users` instead of `doctors`.
-- All behaviour, permissions, and the SECURITY DEFINER context are preserved.
--
-- References: F-A99-01, A2-03

CREATE OR REPLACE FUNCTION public.booking_atomic_insert(
  p_clinic_id       uuid,
  p_patient_id      uuid,
  p_doctor_id       uuid,
  p_service_id      uuid,
  p_date            date,
  p_start_time      text,
  p_end_time        text,
  p_slot_start      text,
  p_slot_end        text,
  p_status          text,
  p_is_first_visit  boolean,
  p_has_insurance   boolean,
  p_booking_source  text,
  p_notes           text DEFAULT NULL,
  p_is_emergency    boolean DEFAULT false,
  p_max_per_slot    integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt_id    uuid;
  v_slot_count integer;
  v_lock_key   bigint;
  v_doctor_ok  boolean;
  v_service_ok boolean;
  v_patient_ok boolean;
BEGIN
  -- ── Cross-tenant validation ──────────────────────────────────────────────
  -- SECURITY DEFINER bypasses RLS, so we enforce tenant scoping manually.
  -- Each of doctor / service / patient must belong to the supplied clinic.

  -- FIX (was: FROM doctors — relation does not exist; F-A99-01 / A2-03):
  -- Doctors are stored in the `users` table; the clinic_id FK is sufficient
  -- to prove membership. Role is intentionally not checked here — any user
  -- (doctor, specialist, nurse, etc.) may be assigned to an appointment slot
  -- as long as they belong to the same clinic.
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = p_doctor_id AND clinic_id = p_clinic_id
  ) INTO v_doctor_ok;
  IF NOT v_doctor_ok THEN
    RAISE EXCEPTION 'INVALID_TENANT: doctor does not belong to clinic'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM services WHERE id = p_service_id AND clinic_id = p_clinic_id
  ) INTO v_service_ok;
  IF NOT v_service_ok THEN
    RAISE EXCEPTION 'INVALID_TENANT: service does not belong to clinic'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = p_patient_id AND clinic_id = p_clinic_id
  ) INTO v_patient_ok;
  IF NOT v_patient_ok THEN
    RAISE EXCEPTION 'INVALID_TENANT: patient does not belong to clinic'
      USING ERRCODE = '42501';
  END IF;

  -- Compute a deterministic lock key from the slot identity.
  -- pg_advisory_xact_lock is released automatically at transaction end.
  v_lock_key := hashtext(p_clinic_id::text || p_doctor_id::text || p_date::text || p_start_time);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Count how many non-cancelled bookings already exist for this slot.
  SELECT COUNT(*) INTO v_slot_count
  FROM appointments
  WHERE clinic_id   = p_clinic_id
    AND doctor_id   = p_doctor_id
    AND appointment_date = p_date
    AND start_time  = p_start_time
    AND status IN ('confirmed', 'pending', 'rescheduled');

  IF v_slot_count >= p_max_per_slot THEN
    RAISE EXCEPTION 'SLOT_FULL: slot already has % of % allowed bookings',
      v_slot_count, p_max_per_slot
      USING ERRCODE = '23505'; -- unique_violation code so the app handles it
  END IF;

  INSERT INTO appointments (
    clinic_id, patient_id, doctor_id, service_id,
    appointment_date, start_time, end_time,
    slot_start, slot_end,
    status, is_first_visit, insurance_flag,
    booking_source, notes, is_emergency
  ) VALUES (
    p_clinic_id, p_patient_id, p_doctor_id, p_service_id,
    p_date, p_start_time, p_end_time,
    p_slot_start::timestamptz, p_slot_end::timestamptz,
    p_status, p_is_first_visit, p_has_insurance,
    p_booking_source, p_notes, p_is_emergency
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;
END;
$$;
