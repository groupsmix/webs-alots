# ADR-0007: Subdomain routing over path-based multi-tenancy

**Date:** 2026-05-27
**Status:** Accepted
**Deciders:** Core team

## Context

Multi-tenant SaaS applications must isolate tenants. The two common URL strategies are:

- **Path-based**: `app.oltigo.com/clinics/:slug/dashboard`
- **Subdomain-based**: `:slug.oltigo.com/dashboard`

## Decision

Use subdomain-based routing. Each clinic gets `{subdomain}.oltigo.com`.

## Rationale

1. **Stronger cookie isolation**: Cookies scoped to `clinic-a.oltigo.com` cannot be read by `clinic-b.oltigo.com`. Path-based routing shares cookies across tenants unless carefully partitioned.
2. **Cleaner public-facing URLs**: Patient-facing booking pages (`drclinic.oltigo.com/book`) are more professional than `oltigo.com/clinics/drclinic/book`.
3. **Middleware simplicity**: `extractSubdomain(hostname)` is a single string operation. Path-based routing requires parsing every URL and maintaining route prefixes.
4. **Future custom domains**: Subdomain routing maps naturally to custom domain support (CNAME `appointments.drclinic.ma` → `drclinic.oltigo.com`).

## Trade-offs

- Wildcard DNS and TLS configuration required (Cloudflare handles this).
- Local development requires `/etc/hosts` entries or a wildcard DNS proxy.
- Subdomain resolution adds a Supabase query per new visitor (mitigated by in-memory cache with TTL + negative cache).

## Consequences

- `src/middleware.ts` resolves subdomain → clinic via `resolveSubdomainClinic()`.
- `src/lib/subdomain-cache.ts` provides in-memory cache with TTL and negative-cache for invalid subdomains.
- Tenant headers (`x-tenant-clinic-id`, etc.) are set by middleware and consumed by `getTenant()`.
