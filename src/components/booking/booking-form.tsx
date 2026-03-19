"use client";

/**
 * BookingForm
 *
 * Multi-step booking form with:
 * - Specialty selector (if multi-doctor clinic)
 * - Doctor selector
 * - Service selector
 * - Date picker (available days only)
 * - Time slot picker (free slots only)
 * - Patient info form
 * - Insurance flag
 * - First visit vs. return detection
 */
export function BookingForm() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Book an Appointment</h2>
      <p className="text-sm text-muted-foreground">
        Booking form will be implemented here.
      </p>
    </div>
  );
}
