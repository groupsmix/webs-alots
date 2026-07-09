# Failure Semantics Matrix

Oltigo does not use one universal failure posture. Different subsystems fail closed, degrade gracefully, or intentionally fail open depending on the security and operational tradeoff.

## 1. Matrix

| Subsystem                                            | Default posture                         | Failure behavior                                                                                                                                                                | Source                                        |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Tenant context in `withAuth()` / `withAuthAnyRole()` | Fail closed                             | If tenant context cannot be established for a tenant-scoped route, the wrapper returns `503 TENANT_CONTEXT_UNAVAILABLE` unless the caller explicitly opts into `failOpen: true` | `src/lib/with-auth.ts`                        |
| `setTenantContext()` on authenticated clients        | Expected permission denial is tolerated | The service-role-only `set_tenant_context` denial is treated as an expected branch, not a crash, when resolving auth context                                                    | `src/lib/with-auth.ts`                        |
| Rate limiting                                        | Mixed                                   | Security-critical limiters default to `failClosed: true`; non-critical limiters degrade to in-memory fallback, and KV-backed limiters apply a grace window before hard denial   | `src/lib/rate-limit.ts`                       |
| Global AI kill switch                                | Mixed / fail-open                       | `AI_DISABLED=true` is an immediate hard stop, but missing KV, missing `ai.enabled`, or KV read failure defaults to enabled for backward compatibility                           | `src/lib/features.ts`, `src/lib/env-flags.ts` |
| AI feature toggles                                   | Opt-in, not fail-closed                 | If toggle rows cannot be loaded, the system returns an empty toggle map and does not block requests; unknown `feature_key` values are allowed by design                         | `src/lib/ai/feature-toggles.ts`               |

## 2. Why the AI Posture Is Special

The AI control plane has **two different control surfaces** with different failure semantics:

1. **Environment override** — `AI_DISABLED=true`
   - hard stop
   - no KV dependency
   - wins over the dashboard state

2. **Operational runtime control** — KV-backed `ai.enabled`
   - fast to flip during incidents
   - used by the super-admin emergency stop UI
   - defaults to enabled when KV is unavailable or unset

This is deliberate: the environment variable is the incident-response-grade stop, while KV is the normal operator control plane.

## 3. Design Rule

When documenting or reviewing a subsystem, do not ask only:

- "What happens when it works?"

Also ask:

- What happens when the dependency is missing?
- What happens when the backend is degraded but not fully down?
- Is the failure posture meant to protect security, protect availability, or preserve backwards compatibility?

For AI specifically, see `docs/adr/0014-ai-fail-open-toggle-posture.md`.
