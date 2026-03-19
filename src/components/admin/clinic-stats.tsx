"use client";

/**
 * ClinicStats
 *
 * Key metrics cards: patient count, no-show rate, booking sources, busiest hours.
 */
export function ClinicStats() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Total Patients</p>
        <p className="text-2xl font-bold">--</p>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Today&apos;s Bookings</p>
        <p className="text-2xl font-bold">--</p>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">No-Show Rate</p>
        <p className="text-2xl font-bold">--</p>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Revenue (MTD)</p>
        <p className="text-2xl font-bold">--</p>
      </div>
    </div>
  );
}
