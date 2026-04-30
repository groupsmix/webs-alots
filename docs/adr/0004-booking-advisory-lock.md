# ADR-0004: Advisory Lock for Atomic Booking Slot Enforcement

## Status

Accepted

## Date

2026-04-30

## Context

The booking system must enforce `maxPerSlot` - the maximum number of
concurrent appointments for a (clinic, doctor, date, time) tuple. The
original implementation used a post-insert compensation pattern:

1. Insert the appointment
2. Count active bookings for the slot
3. If count > maxPerSlot, delete the just-inserted row

This is subject to a TOCTOU (Time-of-Check-Time-of-Use) race condition
under concurrent requests due to PostgreSQL MVCC snapshot isolation.
Two requests can both insert, both count <= maxPerSlot (each seeing
only their own row plus pre-existing ones), and both keep their rows.

Identified as CVE-2026-XXXXX (internal audit A96-01).

## Decision

Use a **PostgreSQL advisory lock** (`pg_advisory_xact_lock`) within a
**SECURITY DEFINER RPC** (`booking_atomic_insert`) to serialize slot
checks. The lock key is derived from `hashtext(clinic_id || doctor_id
|| date || start_time)`. The RPC:

1. Acquires the advisory lock (blocks concurrent callers)
2. Counts existing active bookings
3. If count >= maxPerSlot, raises an exception (no insert)
4. Otherwise inserts the appointment
5. Lock is released automatically at transaction end

Migration: `supabase/migrations/00074_booking_slot_advisory_lock.sql`
Application: `src/app/api/booking/route.ts` calls `supabase.rpc("booking_atomic_insert", ...)`

## Alternatives Considered

1. **Partial unique index** - `CREATE UNIQUE INDEX ON appointments
   (clinic_id, doctor_id, appointment_date, start_time) WHERE status
   IN (...)` - Works for maxPerSlot=1 but cannot enforce maxPerSlot>1.
2. **SELECT FOR UPDATE** - Requires a "slot" row to exist before
   booking; adds schema complexity.
3. **Application-level distributed lock (Redis/KV)** - Adds external
   dependency; advisory locks are native to PostgreSQL.

## Consequences

- **Positive**: Atomic enforcement; no race conditions; no external
  dependencies; advisory locks are lightweight and auto-released.
- **Negative**: Serializes concurrent bookings for the same slot
  (acceptable since slot contention is rare in practice).
- **Risk**: If the RPC is bypassed (direct insert), the advisory lock
  is not enforced. RLS policies and the partial unique index
  (00073 migration) provide defense-in-depth.
