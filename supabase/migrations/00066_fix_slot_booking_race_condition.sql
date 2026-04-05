-- ============================================================
-- Migration 00066: Fix Slot Booking Race Condition (CRITICAL-03)
-- ============================================================
-- 
-- PROBLEM: The booking endpoint checks maxPerSlot with a SELECT query,
-- then inserts the appointment. Between SELECT and INSERT, another
-- request can book the same slot, causing overbooking.
--
-- SOLUTION: Create a database function that atomically checks slot
-- availability and inserts the appointment in a single transaction.
-- This eliminates the race condition window.
-- ============================================================

-- Drop existing function if it exists (for idempotent migrations)
DROP FUNCTION IF EXISTS book_slot_atomic(
  p_clinic_id UUID,
  p_doctor_id UUID,
  p_patient_id UUID,
  p_service_id UUID,
  p_slot_start TIMESTAMPTZ,
  p_slot_end TIMESTAMPTZ,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_max_per_slot INT,
  p_is_first_visit BOOLEAN,
  p_insurance_flag BOOLEAN,
  p_booking_source TEXT,
  p_notes TEXT
);

-- Create atomic booking function
CREATE OR REPLACE FUNCTION book_slot_atomic(
  p_clinic_id UUID,
  p_doctor_id UUID,
  p_patient_id UUID,
  p_service_id UUID,
  p_slot_start TIMESTAMPTZ,
  p_slot_end TIMESTAMPTZ,
  p_appointment_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_max_per_slot INT,
  p_is_first_visit BOOLEAN DEFAULT FALSE,
  p_insurance_flag BOOLEAN DEFAULT FALSE,
  p_booking_source TEXT DEFAULT 'online',
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  appointment_id UUID,
  status TEXT,
  error_code TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INT;
  v_appointment_id UUID;
BEGIN
  -- Lock the slot for this transaction to prevent concurrent bookings
  -- Use advisory lock based on doctor_id + slot_start hash
  PERFORM pg_advisory_xact_lock(
    hashtext(p_doctor_id::TEXT || p_slot_start::TEXT)
  );

  -- Count existing appointments in this slot (excluding cancelled/no-show)
  SELECT COUNT(*) INTO v_current_count
  FROM appointments
  WHERE clinic_id = p_clinic_id
    AND doctor_id = p_doctor_id
    AND slot_start = p_slot_start
    AND status NOT IN ('cancelled', 'no_show');

  -- Check if slot is full
  IF v_current_count >= p_max_per_slot THEN
    RETURN QUERY SELECT NULL::UUID, 'slot_full'::TEXT, 'SLOT_FULL'::TEXT;
    RETURN;
  END IF;

  -- Slot available — insert appointment
  INSERT INTO appointments (
    clinic_id,
    doctor_id,
    patient_id,
    service_id,
    slot_start,
    slot_end,
    appointment_date,
    start_time,
    end_time,
    status,
    is_first_visit,
    insurance_flag,
    booking_source,
    notes
  ) VALUES (
    p_clinic_id,
    p_doctor_id,
    p_patient_id,
    p_service_id,
    p_slot_start,
    p_slot_end,
    p_appointment_date,
    p_start_time,
    p_end_time,
    'confirmed',
    p_is_first_visit,
    p_insurance_flag,
    p_booking_source,
    p_notes
  )
  RETURNING id INTO v_appointment_id;

  -- Return success
  RETURN QUERY SELECT v_appointment_id, 'success'::TEXT, NULL::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION book_slot_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION book_slot_atomic TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION book_slot_atomic IS 
  'Atomically checks slot availability and creates appointment. ' ||
  'Uses advisory locks to prevent race conditions in concurrent bookings. ' ||
  'Returns (appointment_id, status, error_code) where status is "success" or "slot_full".';
