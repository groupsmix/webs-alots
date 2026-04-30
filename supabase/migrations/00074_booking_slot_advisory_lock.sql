-- AUDIT-17: Atomic booking slot enforcement via advisory lock.
--
-- The application-level insert-then-count-then-delete pattern for maxPerSlot
-- enforcement is subject to TOCTOU races under concurrent requests. This RPC
-- wraps the slot check + insert in a single transaction with an advisory lock
-- so that only one booking at a time can claim a slot for a given
-- (clinic, doctor, date, time) tuple.
--
-- Usage from the app:
--   const { data, error } = await supabase.rpc('booking_atomic_insert', {
--     p_clinic_id, p_patient_id, p_doctor_id, p_service_id,
--     p_date, p_start_time, p_end_time, p_slot_start, p_slot_end,
--     p_status, p_is_first_visit, p_has_insurance, p_booking_source,
--     p_notes, p_is_emergency, p_max_per_slot
--   });

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
  v_lock_key   bigint;
  v_slot_count integer;
  v_appt_id    uuid;
  v_doctor_ok  boolean;
  v_service_ok boolean;
  v_patient_ok boolean;
BEGIN
  -- AUDIT-17 HARDENING: Because this function is SECURITY DEFINER and granted
  -- to `anon` (the public booking flow is unauthenticated), it bypasses RLS.
  -- Without the validations below, any unauthenticated client could call this
  -- RPC with arbitrary (clinic_id, doctor_id, service_id, patient_id) tuples
  -- and insert rows into another clinic's appointments table.
  --
  -- Enforce that doctor, service, and patient all belong to the supplied
  -- clinic before acquiring the advisory lock. This replaces the RLS check
  -- that SECURITY DEFINER suppresses and keeps the RPC safe for `anon`.
  SELECT EXISTS (
    SELECT 1 FROM doctors WHERE id = p_doctor_id AND clinic_id = p_clinic_id
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

  -- Count existing active bookings for this slot
  SELECT count(*)::integer INTO v_slot_count
    FROM appointments
   WHERE clinic_id = p_clinic_id
     AND doctor_id = p_doctor_id
     AND appointment_date = p_date
     AND start_time = p_start_time
     AND status IN ('confirmed', 'pending', 'rescheduled');

  IF v_slot_count >= p_max_per_slot THEN
    RAISE EXCEPTION 'SLOT_FULL: slot already has % of % allowed bookings',
      v_slot_count, p_max_per_slot
      USING ERRCODE = '23505'; -- unique_violation code so the app handles it
  END IF;

  -- Insert the appointment
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

-- Grant execute to authenticated and anon (booking flow uses anon via RPC)
GRANT EXECUTE ON FUNCTION public.booking_atomic_insert TO authenticated, anon;
