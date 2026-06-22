# Tenant & PHI Security — Edge Cases and Worked Examples

This file holds the cases that don't fit cleanly into the SKILL.md gates.
Read it when one of these situations applies; otherwise SKILL.md alone is
sufficient.

## 1. Legitimate cross-tenant reads (super_admin)

The only legitimate exception to "always filter by clinic_id" is a
`super_admin`-only view (e.g., the master dashboard). Even then:

- The role check (`super_admin`) must happen *before* the query, via
  `withAuth(handler, ["super_admin"])` — never inferred from the absence of a
  clinic_id.
- The query should still be explicit about scope, e.g. iterating clinics or
  using an admin-specific view — not just "select * with no filter because
  the role check makes it fine." A reviewer six months from now won't have
  the role check in their head when they read the query in isolation.

```ts
// Acceptable — explicit role gate, explicit intent
export const GET = withAuth(async (req) => {
  const clinics = await supabase.from("clinics").select("id, name, status");
  return apiSuccess({ clinics });
}, ["super_admin"]);
```

## 2. Cron jobs / scheduled tasks

Cron jobs don't have a request-derived tenant — they must loop over clinics
explicitly and scope each iteration:

```ts
// Bad — operates across all clinics in one untenanted query
const overdue = await supabase.from("invoices").select("*").lt("due_date", today);

// Good — iterate, scope each iteration
const clinics = await supabase.from("clinics").select("id");
for (const clinic of clinics.data ?? []) {
  const overdue = await supabase
    .from("invoices")
    .select("*")
    .eq("clinic_id", clinic.id)
    .lt("due_date", today);
  // process per-clinic
}
```

## 3. Soft deletes

If a table uses a `deleted_at` column instead of a hard delete, every
`.select()` on that table needs `.is("deleted_at", null)` *in addition to*
the `clinic_id` filter — a soft-deleted row scoped to the right clinic is
still a data leak if it shows up in a list view it shouldn't.

## 4. Webhook clinic_id resolution failure — what "drop the event" means

When a WhatsApp or Stripe webhook can't be resolved to a clinic (unknown
WABA phone ID, missing/stale metadata), the correct behavior is:

```ts
const clinicId = resolveClinicFromWebhook(payload);
if (!clinicId) {
  logger.warn("webhook.unresolved_tenant", { source: "whatsapp" }); // no PHI in the log
  return apiSuccess({ received: true }); // ack to the provider, do nothing else
}
```

Returning a 200 without further processing (rather than a 4xx/5xx) matters —
most webhook providers retry on failure, and retrying an unresolvable event
indefinitely is its own problem.

## 5. Pairing a tenant-isolation test with the implementation

Per `AGENTS.md`, a Zod schema test alone is insufficient. Minimum bar for a
new route handler that touches patient/clinic data:

```ts
it("does not return another clinic's appointment", async () => {
  const clinicA = createMockTenantHeaders({ clinicId: "clinic-a" });
  const clinicB = createMockTenantHeaders({ clinicId: "clinic-b" });
  await createAppointment(clinicB, { id: "appt-1" });

  const res = await GET(createMockRequest({ headers: clinicA }));
  const body = await res.json();

  expect(body.data.appointments.find((a) => a.id === "appt-1")).toBeUndefined();
});
```

If you can't write this test because the mock utilities don't support it yet,
that's a signal to extend `src/components/__tests__/test-utils.ts` rather than
skip the test.

## 6. When the scanner and the manual checklist disagree

The scanner is a heuristic — if it flags something you've verified is safe
(e.g., a `.from()` call where `clinic_id` is enforced by a wrapper function a
few lines away, outside its 6-line window), trust the manual review, not the
script. Don't suppress the warning by restructuring code just to satisfy the
pattern-matcher; restructure only if the manual review also finds a real
issue.
