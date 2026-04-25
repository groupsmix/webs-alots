# Oltigo Health — Fix List (Remaining Items)

*Note: All P0 items have been fixed!*

## P1 — fix this week

8. **withAuth + middleware double-query Supabase per request**
   - **Files:** `src/middleware.ts`, `src/lib/with-auth.ts`
   - **Problem:** Middleware runs `getUser()` + `users` SELECT, then `withAuth` runs them again.

9. **CSRF allow-list trusts every *.oltigo.com peer**
   - **File:** `src/lib/middleware/csrf.ts`
   - **Problem:** Any tenant subdomain can issue same-cookie requests against any other tenant subdomain.

10. **Body size limit relies on attacker-supplied Content-Length**
    - **File:** `src/middleware.ts`

11. **Rate limiter falls open during Supabase outages**
    - **File:** `src/lib/rate-limit.ts`
    - **Problem:** Circuit breaker → in-memory per isolate → effectively no limit during a Supabase blip.

12. **STAFF_DEFAULT_PASSWORD constant in onboarding**
    - **File:** `src/lib/super-admin-actions.ts`, `src/lib/constants.ts`

13. **Sentry Session Replay captures PHI in DOM**
    - **File:** `sentry.client.config.ts`

14. **Stale supabase/full_backup.sql in tree**
    - **Problem:** Tracked in git despite `.gitignore`. Sets a precedent for committing real backups.

15. **Service-role key is single-point-of-failure**
    - **Files:** `src/lib/supabase-server.ts:124`, all callers.

## P2 — fix this month

16. **CSP allows direct exfiltration to Meta/Twilio/Cloudflare**
    - **File:** `src/lib/middleware/security-headers.ts`

17. **next/image allows **.supabase.co**
    - **File:** `next.config.ts`

18. **extractClientIp accepts spoofable XFF on Workers**
    - **File:** `src/lib/rate-limit.ts`

19. **Audit-log writes are best-effort**
    - **File:** `src/lib/audit-log.ts`

20. **GitHub Actions pinned by tag, not SHA**
    - **Files:** `.github/workflows/*.yml`

21. **update-secrets.yml lacks Environment protection**
    - **File:** `.github/workflows/update-secrets.yml`

22. **Demo tenant lives in production DB**
    - **Files:** `supabase/migrations/00046_demo_tenant.sql`, `00053_demo_tenant_enhance.sql`

23. **/api/health runs full checks per request**
    - **File:** `src/app/api/health/route.ts`

24. **connection-pool.ts may bypass Supabase pooler**
    - **File:** `src/lib/connection-pool.ts`

25. **Husky pre-commit runs full vitest**
    - **File:** `.husky/pre-commit`

26. **No SBOM / CodeQL / secret scan / SAST**
    - **File:** `.github/workflows/ci.yml`

27. **frame-src 'self' www.google.com — purpose unclear**
    - **File:** `src/lib/middleware/security-headers.ts`

28. **CSP nonce uses base64-of-UUID**
    - **File:** `src/middleware.ts`

29. **lint-staged glob misses .mjs/.cjs/.js**
    - **File:** `package.json`

30. **No SOPs for non-PHI secret compromise**
    - **File:** `docs/SOP-SECRET-ROTATION.md` (new)
