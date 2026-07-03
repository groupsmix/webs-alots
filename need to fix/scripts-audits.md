Here is the full audit report for the scripts/ directory based on your requested criteria. I reviewed the static logic, ran eslint, shellcheck, and executed npm audit against the dependencies.

Fortunately, eslint found 0 syntax or runtime errors within the scripts, and npm audit found 0 known vulnerabilities in your package.json dependencies!

Below is the prioritized list of findings across bugs, security issues, performance, and code quality.

🚨 HIGH PRIORITY (Security & Logic Bugs)
1. Secret Rotation Bug (False Positives/Negatives)
File: scripts/check-secret-rotation.sh (Lines 57-59)
What's wrong: LAST_DATE=$(grep -i "$SECRET" "$LOG_FILE" ...) performs a partial substring match when searching the log file.
Why it's a problem: If one secret's name is a substring of another (e.g., API_KEY vs RESEND_API_KEY or CRON_SECRET vs WEBHOOK_CRON_SECRET), grep will pull the rotation date for the wrong secret. This could result in overdue secrets being falsely reported as "OK", leaving the system vulnerable to stale/leaked secrets.
Suggested fix: Use word boundaries to enforce exact matches. Update the grep command to: grep -iw "$SECRET" or grep -E "\b${SECRET}\b".
2. Hardcoded Privileged Passwords
File: scripts/seed.ts (Lines ~220-338)
What's wrong: The script contains hardcoded, predictable passwords (e.g., "SuperAdmin123!", "ClinicAdmin123!") for highly privileged roles.
Why it's a problem: While there is a documented seed-guard.ts mechanism designed to block these accounts in production, relying solely on an application-level guard is a precarious defense-in-depth strategy. If that guard ever fails, contains a logic flaw, or is accidentally bypassed during a refactor, an attacker could instantly compromise the entire multi-tenant system using these well-known credentials.
Suggested fix: Generate random, strong passwords dynamically using Node's crypto module during the seed process, or pull them securely from your environment variables (e.g., process.env.SEED_ADMIN_PASSWORD).
⚠️ MEDIUM PRIORITY (Performance & Silent Failures)
3. Silent Failure on Deployment Verification (Smoke Test)
File: scripts/smoke-post-deploy.mjs (Lines ~113)
What's wrong: The fetchText() helper does not check if res.ok is true before returning the response text.
Why it's a problem: If the /register endpoint completely crashes and returns an HTTP 500 or 404 HTML error page, fetchText() will silently accept it. The subsequent regex will fail to find Next.js chunk references in the error page, and the script will log an inaccurate, misleading error (signup integrity: no client JS chunks referenced) instead of instantly alerting you that the page is completely broken.
Suggested fix: Add a strict HTTP status check to fetchText(): if (!res.ok) throw new Error(\HTTP ${res.status} ${res.statusText}`);`
4. N+1 Query Performance Degradation
File: scripts/purge-junk-clinics.ts (Lines 74-78)
What's wrong: The script loops over the junk array with a for...of loop, executing sequential, blocking Supabase queries (await supabase.from("users").select(...)) to verify patient counts for each clinic one-by-one.
Why it's a problem: This creates an N+1 query problem. If the system accumulates hundreds of junk clinics, these sequential HTTP requests will cause the script to take an unnecessarily long time to execute, potentially timing out your CI runner or cron job.
Suggested fix: Batch the queries. Extract all junk clinic IDs and perform a single in query: .in('clinic_id', junk.map(c => c.id)).
5. Severe I/O Bottleneck in Key Rotation
File: scripts/rotate-phi-key.ts (Lines ~372)
What's wrong: During PHI key rotation, the script iterates over files using a standard for loop, downloading, decrypting, encrypting, and uploading each file entirely sequentially.
Why it's a problem: Network I/O is blocked for every single file. If a clinic accumulates thousands of PHI documents, the rotation script could take hours to complete and may exceed the Cloudflare Worker/Lambda execution time limits.
Suggested fix: Introduce concurrency. Process the keys in batches (chunks of 10-20 files at a time) using Promise.all() to saturate the network without overwhelming memory.
💡 LOW PRIORITY (Code Quality & Hygiene)
6. Non-Portable Glob Execution on Windows
File: scripts/check-tenant-scoping.mjs (Line 124)
What's wrong: Uses execSync('git ls-files "src/app/api/**/*.ts"').
Why it's a problem: Glob expansion (**/*.ts) within double quotes is brittle when passed to cmd.exe on Windows (which execSync uses by default). While Git internally resolves it in most cases, relying on shell-level glob resolution is generally discouraged for cross-platform Node.js scripts and could cause silent misses if the environment is misconfigured.
Suggested fix: Use Node's built-in fs.readdirSync with recursive: true and a regex filter, or the glob npm package.
7. Missing Temporary File Cleanup (Stale Files)
File: scripts/check-db-types-drift.sh (Lines 20, 38)
What's wrong: The script generates a temporary file /tmp/db-types-regen.ts but never deletes it if the script errors out early or exits successfully (unless the system reboots).
Why it's a problem: Successive runs or failed runs will leave stale artifacts littering the /tmp directory, which is poor script hygiene.
Suggested fix: Add a trap immediately after creating the variable at the top of the file: trap 'rm -f "$TMP_REGEN"' EXIT (This pattern is correctly used in triage-eslint-warnings.sh).