-- Align booking_atomic_insert's slot-fullness check with the actual
-- double-booking guarantee enforced by the database.
--
-- Background:
--   * 00026 created the partial UNIQUE index `idx_no_double_booking` on
--       (clinic_id, doctor_id, appointment_date, start_time)
--       WHERE status NOT IN ('cancelled', 'no_show')
--     i.e. AT MOST ONE active appointment may exist per slot, regardless of
--     which active status it is in.
--   * booking_atomic_insert (00074, fixed in 00143) counted slot occupancy with
--       status IN ('confirmed', 'pending', 'rescheduled')
--     which OMITS the other active statuses added later — 'reminded' (00142),
--     'checked_in', 'in_progress', 'completed'. An appointment in one of those
--     states did not count toward the SLOT_FULL check, so the function would
--     attempt the INSERT and rely on the unique index to reject it with 23505.
--
-- Net effect of the mismatch: double-booking was still prevented (by the index),
-- but the function raised a confusing path — the explicit SLOT_FULL guard and
-- the index disagreed about what "occupied" means. This migration makes the
-- function's occupancy definition identical to the index's, so the explicit
-- SLOT_FULL error is raised consistently.
--
-- This is the ONLY behavioural change vs 00143. Signature, SECURITY DEFINER
-- context, cross-tenant validation, advisory lock, INSERT, and grants are
-- preserved verbatim so the pgTAP pins in
-- supabase/tests/booking_atomic_insert.test.sql stay green.
--
-- NOTE on p_max_per_slot: because idx_no_double_booking is UNIQUE, a value
-- greater than 1 cannot actually permit a second active booking — the index
-- will reject it. The parameter is retained for signature/grant stability and
-- effectively behaves as a hard cap of 1.

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

  -- Count how many ACTIVE bookings already exist for this slot. "Active" must
  -- match the predicate of idx_no_double_booking (everything except cancelled
  -- / no_show) so the explicit guard and the unique index agree.
  SELECT COUNT(*) INTO v_slot_count
  FROM appointments
  WHERE clinic_id   = p_clinic_id
    AND doctor_id   = p_doctor_id
    AND appointment_date = p_date
    AND start_time  = p_start_time
    AND status NOT IN ('cancelled', 'no_show');

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

-- ── Re-assert grants exactly as 00143 (pinned by the pgTAP grant test) ───────
REVOKE EXECUTE ON FUNCTION public.booking_atomic_insert(
  uuid, uuid, uuid, uuid, date,
  text, text, text, text, text,
  boolean, boolean, text, text, boolean, integer
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.booking_atomic_insert(
  uuid, uuid, uuid, uuid, date,
  text, text, text, text, text,
  boolean, boolean, text, text, boolean, integer
) FROM service_role;

GRANT EXECUTE ON FUNCTION public.booking_atomic_insert(
  uuid, uuid, uuid, uuid, date,
  text, text, text, text, text,
  boolean, boolean, text, text, boolean, integer
) TO authenticated, anon;
