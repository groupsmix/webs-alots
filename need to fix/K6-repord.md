1. BUGS & ERRORS
   [Medium] IPv6 Loopback Match Failure

File: k6/lib/env-guard.js (Line 43)
What's wrong: The script checks for the IPv6 loopback address using hostname === "::1". However, the standard URL parser automatically surrounds IPv6 hostnames with brackets (i.e., "[::1]").
Why it's a problem: The strict equality check will never match a legitimate IPv6 address. If a developer runs tests targeting http://[::1]/, the script will misclassify it as "unknown" instead of "local" and crash, preventing local IPv6 testing.
Suggested fix: Change the condition to match the bracketed format: hostname === "[::1]".
[Low] Trailing Slash Not Stripped in BASE_URL

File: k6/lib/env-guard.js (Line 142)
What's wrong: validateBaseUrl successfully validates the provided baseUrl but returns it exactly as given without stripping any trailing slashes.
Why it's a problem: If a user runs the script with BASE_URL=https://staging.oltigo.com/ (with a trailing slash), string interpolations like ${BASE_URL}/api/ping will generate double-slashed URLs (https://staging.oltigo.com//api/ping). This can trigger unexpected 404s, routing errors, or unnecessary server-side redirects that skew performance metrics.
Suggested fix: Normalize the string by stripping trailing slashes before returning it: const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
[Low] Missing Leading Slash Enforcement on Path Variables

File: k6/booking-flow.js (Lines 101, 108)
What's wrong: BOOKING_PATH and AUTH_PATH are extracted from environment variables. They lack defensive checks to guarantee they begin with a forward slash.
Why it's a problem: If a user overrides these values incorrectly (e.g., --env BOOKING_PATH=book), the script will directly concatenate it and produce an invalid domain string like https://staging.oltigo.combook, instantly failing the requests.
Suggested fix: Prepend a slash defensively when injecting the variables, or normalize them during variable initialization: const path = **ENV.BOOKING_PATH?.startsWith('/') ? **ENV.BOOKING_PATH : '/' + \_\_ENV.BOOKING_PATH; 2. SECURITY ISSUES
No security vulnerabilities were found. These scripts act as external clients pushing load to the environment. The usage of hardcoded fallback phone numbers, mock data, and domain whitelists is intentional. HTTPS enforcement logic correctly prevents credentials from being passed in plaintext over non-local networks.

3. BLOCKERS
   No execution blockers were found.

All dependencies (k6, k6/http, k6/metrics) are standard built-in modules for the k6 runtime.
Module resolutions (like import { validateBaseUrl } from "./lib/env-guard.js";) are correctly pathed for ES Module resolution.
\_\_ENV injection conforms properly to k6 standards. The scripts will run cleanly out-of-the-box. 4. PERFORMANCE & CODE QUALITY
[Low] Duplicated JSON Parsing Logic

File: k6/smoke.js (Line 141) and k6/booking-flow.js (Line 215)
What's wrong: Both test scripts contain almost identical helper functions (parseJsonBody and parseJson) designed to safely parse responses and catch JSON.parse exceptions.
Why it's a problem: This violates the DRY (Don't Repeat Yourself) principle. If the team decides to update how errors are logged or metrics are tracked during a parse failure, they will have to update it in multiple places, increasing the risk of code drift.
Suggested fix: Extract the parsing utility function into k6/lib/env-guard.js (or a dedicated k6/lib/utils.js file) and export it, allowing both scripts to import a single source of truth.
