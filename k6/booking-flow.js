/**
 * k6 booking-flow load test — Oltigo Health.
 *
 * Models the patient booking journey against a DEPLOYED environment. Closes
 * audit finding RISK-006 ("No Load Testing — full booking flow"). Run MANUALLY
 * or via the scheduled `.github/workflows/load-test.yml` job. This is NOT a
 * post-deploy gate (that is scripts/smoke-post-deploy.mjs).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS ACTUALLY TESTS (and why it differs from the audit skeleton)
 * ─────────────────────────────────────────────────────────────────────────────
 * The original audit sketch assumed `/api/auth/login` returning a bearer token,
 * `/api/appointments`, and `/api/upload` with `Authorization: Bearer`. None of
 * those match the real app:
 *
 *   - Auth is Supabase SSR COOKIES (@supabase/ssr). Protected routes
 *     (upload, cancel, /api/appointments) read the session from cookies and do
 *     NOT accept an Authorization: Bearer JWT. There is no token to forward.
 *   - The public booking write path is POST /api/booking, gated by a one-time
 *     HMAC `x-booking-token` from POST /api/booking/verify — NOT a user session.
 *   - Writes have real side effects (DB rows + SMS/email notifications) and are
 *     per-IP rate limited: /api/booking 10/min, /api/booking/verify 10/15min
 *     (fail-closed). A 100-VU blast from a few CI egress IPs would measure 429
 *     handling, not capacity, and would pollute the clinic with fake bookings.
 *
 * Therefore the journey is layered and SAFE BY DEFAULT:
 *
 *   READ journey (default — safe to run at 100 VUs):
 *     1. GET /                 landing page (CDN/SSR)
 *     2. GET ${BOOKING_PATH}   public booking page (default /book) — tenant
 *                              resolution + booking UI shell
 *     3. GET /api/status       platform status (read)
 *   This is the realistic high-traffic patient path (browsing before booking)
 *   and creates no data.
 *
 *   WRITE journey (opt-in: --env BOOKING_WRITE=true):
 *     4. POST /api/booking/verify  → issue a booking token
 *     5. POST /api/booking         → create an appointment (real row)
 *   Disabled by default. When enabled the per-IP rate limits above make high
 *   VU counts pointless, so write mode caps VUs low and EXPECTS some 429s
 *   (counted, not failed). Point it at a DISPOSABLE load-test clinic only.
 *
 *   AUTH journey (opt-in: --env SESSION_COOKIE="sb-...=...; ..."):
 *     6. GET ${AUTH_PATH} with the supplied cookie (default
 *        /api/patient/documents) — a real cookie-protected read.
 *   Sessions are cookie-only (@supabase/ssr) and k6 cannot mint one: login is
 *   rate limited (5/min/IP) and Turnstile-gated, and /api/auth/demo-login only
 *   returns a magic-link token_hash the CLIENT must exchange — it does not set
 *   cookies. So capture a session cookie ONCE and reuse it (see HOW TO CAPTURE
 *   below). Upload/cancel are intentionally NOT automated here — see CAVEATS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage
 * ─────────────────────────────────────────────────────────────────────────────
 *   # Read-only journey (default), 100-VU ramp against staging:
 *   k6 run --env BASE_URL=https://staging.oltigo.com k6/booking-flow.js
 *
 *   # Against a specific clinic subdomain (most realistic booking reads):
 *   k6 run --env BASE_URL=https://demo.staging.oltigo.com k6/booking-flow.js
 *
 *   # Include the write path against a disposable clinic (low VU, expect 429s):
 *   k6 run --env BASE_URL=https://demo.staging.oltigo.com \
 *          --env BOOKING_WRITE=true --env PROFILE=write k6/booking-flow.js
 *
 *   # Quick functional check (tiny ramp), any environment:
 *   k6 run --env BASE_URL=https://staging.oltigo.com --env PROFILE=smoke k6/booking-flow.js
 *
 *   # Include an authenticated read leg (reuses one captured session):
 *   k6 run --env BASE_URL=https://staging.oltigo.com \
 *          --env SESSION_COOKIE="$(cat session-cookie.txt)" k6/booking-flow.js
 *
 * HOW TO CAPTURE SESSION_COOKIE (one-time, robust — no library coupling):
 *   - Browser: log in on staging, open DevTools → Application → Cookies, copy
 *     every cookie whose name starts with "sb-" (incl. any ".0"/".1" chunks)
 *     as a single "name=value; name2=value2" string.
 *   - Playwright: reuse an authenticated storageState's cookies (the e2e suite
 *     already logs in via /login) and join them into the same header string.
 *   Set AUTH_PATH to a route the captured session's role can read (default
 *   /api/patient/documents expects a patient session).
 *
 * Profiles (--env PROFILE=...):
 *   load  (default) — 2m→50, 5m→100, 2m→0   (read journey SLOs)
 *   smoke           — 1 VU, 30s              (functional, all-or-nothing)
 *   write           — 2m→10, 3m→10, 1m→0     (write path; rate-limit aware)
 *
 * SLOs (audit RISK-006 targets, applied to the read journey):
 *   - http_req_duration: p(95)<500ms, p(99)<1000ms
 *   - http_req_failed:   rate<0.01
 */

/* eslint-disable import/no-anonymous-default-export */
import { check, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate } from "k6/metrics";
import { validateBaseUrl } from "./lib/env-guard.js";

// ── Tunables ──────────────────────────────────────────────────────────────────

const PROFILE = (__ENV.PROFILE || "load").toLowerCase();
const BOOKING_WRITE = __ENV.BOOKING_WRITE === "true";
const BOOKING_PATH = __ENV.BOOKING_PATH || "/book";
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "";
// Cookie-protected READ endpoint exercised by the optional authed leg. Default
// targets the patient's own document list (GET /api/patient/documents — patient
// role, no required query params, scoped to the session user). Override to match
// the role of whatever session you captured (e.g. a clinic_admin cookie →
// "/api/patient/timeline?patientId=<uuid>").
const AUTH_PATH = __ENV.AUTH_PATH || "/api/patient/documents";
// A phone the verify endpoint will accept (syntactic check only today). Use an
// obviously-fake test number so any created bookings are easy to identify.
const TEST_PHONE = __ENV.BOOKING_PHONE || "+212600000000";

// `load`/`write` involve the high-VU ramp; treat both as "load mode" so the
// shared guard refuses them against production.
const isLoadMode = PROFILE === "load" || PROFILE === "write";

// ── Custom metrics ──────────────────────────────────────────────────────────

// Read-journey availability kept separate from write-path noise so a rate-
// limited write (429) cannot drag down the read SLO.
const readAvailability = new Rate("read_availability");
// Write-path outcomes, tracked for visibility (NOT used as a pass/fail SLO
// because per-IP rate limits make 429s expected, not failures).
const bookingCreated = new Counter("booking_created");
const bookingRateLimited = new Counter("booking_rate_limited");
const bookingFailed = new Counter("booking_failed");

// ── Setup: validate environment ──────────────────────────────────────────────

export function setup() {
  const { baseUrl, hostClass } = validateBaseUrl(__ENV.BASE_URL, {
    isLoadMode,
    allowProd: __ENV.ALLOW_PROD === "true",
  });

  // The write path mutates data and triggers notifications — refuse it against
  // production outright, even with ALLOW_PROD set.
  if (BOOKING_WRITE && hostClass === "prod") {
    throw new Error(
      "BOOKING_WRITE creates real appointments and notifications and is not permitted " +
        "against production. Target a staging/preview clinic instead.",
    );
  }

  if (BOOKING_WRITE) {
    console.warn(
      "[booking-flow] WRITE path ENABLED — this creates real appointments and may send " +
        "notifications. Use a disposable load-test clinic. Per-IP rate limits (10/min) " +
        "will produce 429s at scale; those are expected and counted, not failed.",
    );
  }

  return { baseUrl };
}

// ── Scenario profiles ─────────────────────────────────────────────────────────

const SCENARIOS = {
  load: {
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 50 }, // ramp up
      { duration: "5m", target: 100 }, // steady state
      { duration: "2m", target: 0 }, // ramp down
    ],
  },
  smoke: {
    executor: "constant-vus",
    vus: 1,
    duration: "30s",
  },
  write: {
    // Low VU on purpose: the write endpoints are per-IP rate limited to
    // 10/min, so more VUs just generate 429s without adding signal.
    executor: "ramping-vus",
    stages: [
      { duration: "2m", target: 10 },
      { duration: "3m", target: 10 },
      { duration: "1m", target: 0 },
    ],
  },
};

const activeScenario = SCENARIOS[PROFILE] || SCENARIOS.load;

// Read-journey SLOs (audit RISK-006). Smoke profile is all-or-nothing.
const readSloThresholds =
  PROFILE === "smoke"
    ? {
        read_availability: ["rate>=1"],
        "http_req_duration{journey:read}": ["p(95)<1000"],
      }
    : {
        // Audit targets: p95<500ms, p99<1000ms, error rate <1%.
        read_availability: ["rate>0.99"],
        "http_req_duration{journey:read}": ["p(95)<500", "p(99)<1000"],
        // Global failure rate budget. The write path tolerates rate-limit 429s
        // via expectedStatuses, so they do not inflate http_req_failed.
        http_req_failed: ["rate<0.01"],
      };

export const options = {
  scenarios: { main: activeScenario },
  thresholds: readSloThresholds,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT = { timeout: "10s" };

function readParams(name) {
  return { ...REQUEST_TIMEOUT, tags: { journey: "read", step: name } };
}

/** Parse a JSON body, returning null (with a diagnostic) on failure. */
function parseJson(r, label) {
  try {
    return JSON.parse(r.body);
  } catch (e) {
    console.warn(`[${label}] JSON.parse failed (status=${r.status}): ${e.message}`);
    return null;
  }
}

// ── Read journey ──────────────────────────────────────────────────────────────

function readJourney(BASE_URL) {
  // 1. Landing page — accept any 2xx/3xx (locale redirects are valid).
  const landing = http.get(`${BASE_URL}/`, {
    ...readParams("landing"),
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }),
  });
  readAvailability.add(check(landing, { "landing 2xx/3xx": (r) => r.status >= 200 && r.status < 400 }));

  // 2. Public booking page. Accept 2xx/3xx — on the apex/staging host without a
  //    clinic subdomain the tenant resolver may redirect to clinic selection,
  //    which is correct behaviour rather than a failure.
  const bookingPage = http.get(`${BASE_URL}${BOOKING_PATH}`, {
    ...readParams("booking_page"),
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }),
  });
  readAvailability.add(
    check(bookingPage, { "booking page 2xx/3xx": (r) => r.status >= 200 && r.status < 400 }),
  );

  // 3. Platform status (200 healthy/degraded, 503 = down but reachable).
  const status = http.get(`${BASE_URL}/api/status`, {
    ...readParams("status"),
    responseCallback: http.expectedStatuses(200, 503),
  });
  readAvailability.add(
    check(status, { "status 200/503": (r) => r.status === 200 || r.status === 503 }),
  );
}

// ── Write journey (opt-in) ──────────────────────────────────────────────────────

function writeJourney(BASE_URL) {
  // 4. Issue a booking token. 200 = issued, 429 = rate limited (expected at
  //    scale), 503 = BOOKING_TOKEN_SECRET not configured on the target.
  const verify = http.post(
    `${BASE_URL}/api/booking/verify`,
    JSON.stringify({ phone: TEST_PHONE }),
    {
      ...REQUEST_TIMEOUT,
      headers: { "Content-Type": "application/json" },
      tags: { journey: "write", step: "verify" },
      responseCallback: http.expectedStatuses(200, 429, 503),
    },
  );

  if (verify.status === 429) {
    bookingRateLimited.add(1);
    return; // backed off by the limiter; nothing more to do this iteration
  }
  if (verify.status !== 200) {
    bookingFailed.add(1);
    check(verify, { "verify issued token (200)": () => false });
    return;
  }

  const verifyBody = parseJson(verify, "verify");
  const token = verifyBody && verifyBody.data ? verifyBody.data.token : undefined;
  if (!token) {
    bookingFailed.add(1);
    check(verify, { "verify returned a token": () => false });
    return;
  }

  // 5. Create the appointment. We do not have real slot IDs here, so a 422
  //    (validation) or 409 (slot taken) is an EXPECTED, healthy rejection of a
  //    synthetic payload — the point of the write path is to exercise the
  //    token + rate-limit + validation machinery under load, not to guarantee a
  //    bookable slot. 200 = created, 429 = rate limited.
  const payload = {
    specialtyId: __ENV.SPECIALTY_ID || "load-test",
    doctorId: __ENV.DOCTOR_ID || "load-test",
    serviceId: __ENV.SERVICE_ID || "load-test",
    date: __ENV.BOOKING_DATE || "2099-01-01",
    time: "09:00",
    isFirstVisit: true,
    hasInsurance: false,
    patient: { name: "Load Test", phone: TEST_PHONE },
    slotDuration: 30,
    bufferTime: 0,
  };
  const book = http.post(`${BASE_URL}/api/booking`, JSON.stringify(payload), {
    ...REQUEST_TIMEOUT,
    headers: { "Content-Type": "application/json", "x-booking-token": token },
    tags: { journey: "write", step: "book" },
    responseCallback: http.expectedStatuses(200, 409, 422, 429),
  });

  if (book.status === 200) bookingCreated.add(1);
  else if (book.status === 429) bookingRateLimited.add(1);
  // 409/422 against a synthetic payload are healthy rejections — neither
  // success nor failure for capacity purposes.

  check(book, {
    "book handled (200/409/422/429)": (r) =>
      r.status === 200 || r.status === 409 || r.status === 422 || r.status === 429,
  });
}

// ── Optional authenticated leg (opt-in) ───────────────────────────────────────

// Authenticated-read availability — only meaningful when SESSION_COOKIE is set.
const authAvailability = new Rate("auth_availability");

function authJourney(BASE_URL) {
  // Exercise a real cookie-protected read with the supplied session. Reusing a
  // single captured session across all VUs is intentional: login is rate
  // limited (5/min/IP) and Turnstile-gated, so per-VU login is neither possible
  // nor desirable. This measures authed read performance (RLS-scoped queries)
  // under concurrency without creating data.
  const res = http.get(`${BASE_URL}${AUTH_PATH}`, {
    ...REQUEST_TIMEOUT,
    headers: { Cookie: SESSION_COOKIE },
    tags: { journey: "auth", step: "read" },
    // 200 = authed OK. 401/403 are surfaced as failures below (expired/invalid
    // cookie or role/path mismatch) rather than counted as transport errors.
    responseCallback: http.expectedStatuses(200, 401, 403),
  });

  const ok = res.status === 200;
  authAvailability.add(ok);
  check(res, {
    "authed read 200 (cookie valid)": () => ok,
  });
  if (res.status === 401 || res.status === 403) {
    console.warn(
      `[auth] ${AUTH_PATH} → ${res.status}: SESSION_COOKIE is invalid/expired, or its role ` +
        `does not match AUTH_PATH. Re-capture the cookie or set --env AUTH_PATH to a route the ` +
        `session's role can read.`,
    );
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function (data) {
  const BASE_URL = data.baseUrl;

  readJourney(BASE_URL);

  if (BOOKING_WRITE) {
    writeJourney(BASE_URL);
  }

  if (SESSION_COOKIE) {
    authJourney(BASE_URL);
  }

  // Think time with jitter (0.5s–2.5s) to avoid synchronised request waves.
  sleep(Math.random() * 2 + 0.5);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAVEATS / why upload + cancel (and per-VU login) are not automated here
 * ─────────────────────────────────────────────────────────────────────────────
 * - Sessions are Supabase SSR COOKIES (@supabase/ssr). k6 cannot mint one:
 *     • login is rate limited to 5/min/IP and Turnstile-gated;
 *     • /api/auth/demo-login returns a magic-link `token_hash` that the CLIENT
 *       must exchange via supabase-js — it does NOT set cookies on its response;
 *     • reconstructing the @supabase/ssr cookie from raw GoTrue tokens couples
 *       the test to that library's internal (and chunked) cookie encoding,
 *       which changes across versions.
 *   The robust path is therefore: capture ONE real session cookie and reuse it
 *   (see HOW TO CAPTURE in the header). That is exactly what the SESSION_COOKIE
 *   authed leg does.
 * - POST /api/upload and POST /api/booking/cancel (and PATCH
 *   /api/appointments/:id/cancel) are cookie-authenticated writes with real
 *   side effects (storage objects, status changes, notifications, waiting-list
 *   promotion). High-VU automation of these is unsafe and, for cancel, also
 *   requires a pre-existing cancellable appointment owned by the session user
 *   inside the cancellation window — not reproducible from synthetic load.
 * - A secret-guarded "load-test" bypass endpoint was considered and REJECTED:
 *   shipping an auth/rate-limit bypass into a PHI application is an
 *   unacceptable attack surface. Authenticated WRITE coverage belongs in the
 *   functional Playwright e2e suite (see e2e/), not in a high-VU load test.
 */
