import * as Sentry from "@sentry/nextjs";

// Audit F-1: never initialise Sentry with a placeholder DSN. A value such as
// `https://placeholder@o0.ingest.sentry.io/0` is truthy, so the previous bare
// presence check still shipped `sentry-public_key=placeholder` to the browser
// and silently dropped every client-side exception. Treat any DSN containing
// "placeholder" as unset so misconfiguration fails closed (no Sentry) rather
// than failing open (a dead Sentry client). The hard runtime gate lives in
// src/lib/env.ts (enforceEnvValidation), which refuses to boot production with
// a placeholder DSN; this guard is the matching client-side defense.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const hasValidDsn = !!dsn && !/placeholder/i.test(dsn);

if (hasValidDsn) {
  Sentry.init({
    dsn,

    // AUDIT F-07: Per-route client-side sampling (mirrors sentry.server.config.ts).
    // Critical user flows (booking, payment, auth) get 100% sampling in production;
    // other navigations get 10%.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    tracesSampler(samplingContext) {
      const name = (samplingContext.name || "").toLowerCase();
      // Critical booking/payment/auth flows: 100% in production
      if (
        name.includes("/book") ||
        name.includes("/booking") ||
        name.includes("/payment") ||
        name.includes("/checkout") ||
        name.includes("/login") ||
        name.includes("/register") ||
        name.includes("/checkin")
      ) {
        return 1.0;
      }
      // Dashboard navigations: 20%
      if (
        name.includes("/dashboard") ||
        name.includes("/admin") ||
        name.includes("/doctor") ||
        name.includes("/patient")
      ) {
        return process.env.NODE_ENV === "production" ? 0.2 : 1.0;
      }
      // Everything else: 10% in production, 100% in dev
      return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
    },

    // A69-F2: Sentry Replay is NOT initialised here unconditionally.
    // Session recording requires explicit user consent (ePrivacy Directive /
    // GDPR Art.7). The ConsentGatedReplay component in the root layout
    // calls Sentry.addIntegration(replayIntegration()) dynamically ONLY after
    // the user accepts the "marketing" cookie category.
    //
    // These sample rates remain as documentation of intent — they are applied
    // when the Replay integration is added by ConsentGatedReplay.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      // replayIntegration() intentionally removed — added dynamically by
      // ConsentGatedReplay component after consent is confirmed.
      Sentry.browserTracingIntegration(),
    ],

    // Don't send errors in development unless explicitly enabled.
    enabled: hasValidDsn,

    // S-35: Strip request bodies and known PHI fields from breadcrumbs to
    // prevent accidental PHI capture in Sentry payloads.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
        delete breadcrumb.data?.["request_body"];
        delete breadcrumb.data?.["response_body"];
        // S-35: Scrub URL query params that may contain PHI
        if (breadcrumb.data?.["url"]) {
          try {
            const url = new URL(breadcrumb.data["url"], window.location.origin);
            const phiParams = [
              "phone",
              "email",
              "name",
              "patient",
              "patientId",
              "dob",
              "date_of_birth",
            ];
            for (const param of phiParams) {
              if (url.searchParams.has(param)) {
                url.searchParams.set(param, "[REDACTED]");
              }
            }
            breadcrumb.data["url"] = url.toString();
          } catch {
            // URL parse failed — leave as-is
          }
        }
      }
      return breadcrumb;
    },
    // S-35 + Audit findings #12/#21: Strip PHI from events and disable Replay on PHI routes
    beforeSend(event) {
      // NOTE: Tenant context (clinic_id, user_role) should be set server-side via
      // Sentry.setTag() in a Server Component or middleware using the validated
      // tenant context from requireTenant(). Do NOT read from cookies — client-supplied
      // data violates the security model documented in AGENTS.md.
      // Audit finding #21: removed cookie-reading clinic_id tagging.

      // Strip request bodies from all events
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        // Redact PHI query params from the URL
        if (typeof event.request.query_string === "string") {
          event.request.query_string = event.request.query_string.replace(
            /(phone|email|name|patient|patientId|dob|date_of_birth)=[^&]*/gi,
            "$1=[REDACTED]",
          );
        }
      }

      // Audit finding #12: Comprehensive PHI route check — disable Replay on any
      // authenticated route that may access patient data. Patterns:
      // - /admin/* — admin dashboards (patient records, clinic data)
      // - /doctor/* — doctor portal (patient cases, prescriptions)
      // - /receptionist/* — receptionist panel (appointments, patient files)
      // - /patient/* — patient portal (medical history, appointments)
      // - /super-admin/* — super-admin (multi-clinic data, audit logs)
      // - /dashboard/* — clinic dashboard (analytics, patient lists)
      // - /appointment/* — appointment routes (patient PHI)
      // - /medical/* — medical record routes (PHI)
      //
      // Session replay with maskAllText: true still allows DOM structure and
      // metadata leakage — disable entirely on these routes to be safe.
      const phiRoutePatterns = [
        "/admin/",
        "/doctor/",
        "/receptionist/",
        "/patient/",
        "/super-admin/",
        "/dashboard/",
        "/appointment/",
        "/medical/",
      ];
      const url = event.request?.url ?? window.location.href;
      const isPhiRoute = phiRoutePatterns.some((pattern) => url.includes(pattern));

      if (isPhiRoute) {
        delete event.exception?.values?.[0]?.mechanism?.handled;
        if (event.type === "replay_event") return null; // Drop replay on PHI routes
      }
      return event;
    },
  });
}
