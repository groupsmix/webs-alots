# Runtime Phase Model

Oltigo runs on Cloudflare Workers via OpenNext, which means correctness depends on **when** code executes, not only on what it does.

## 1. Phases

| Phase                 | Key constraint                                                                                                     | Representative source                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Build time            | Code must not assume live Worker bindings or request context during module initialization                          | `src/lib/cf-bindings.ts`                                                                  |
| Deploy time           | Infra-backed features may need explicit gating if required bindings are not provisioned in the target environment  | `open-next.config.ts`, `wrangler.toml`                                                    |
| Request time          | Cloudflare bindings must be resolved from request-scoped OpenNext context rather than assumed global process state | `src/lib/cf-bindings.ts`, `src/lib/features.ts`                                           |
| Worker isolate time   | In-memory state is isolate-local and may disappear on cold start or rollout                                        | `src/lib/rate-limit.ts`, `src/lib/ai/circuit-breaker.ts`                                  |
| Cross-isolate runtime | Truth that must survive isolate churn must live in KV, R2, queues, or the database                                 | `src/lib/rate-limit.ts`, `src/lib/ai/circuit-breaker.ts`                                  |
| DB / RLS time         | Anonymous and authenticated tenant scoping rely on different trust signals and helper paths                        | `src/lib/with-auth.ts`, `src/lib/tenant.ts`, `docs/architecture/trust-boundary-matrix.md` |

## 2. Concrete Examples

### Request-scoped bindings

`getWorkerBinding()` exists because Cloudflare bindings are not a safe module-level assumption under OpenNext. Callers such as `isAIEnabled()` resolve `FEATURE_FLAGS_KV` lazily at request time.

### Isolate-local fallback is real, but not authoritative

Rate limiting and AI circuit-breaker code both maintain in-memory fallback state so the app can degrade gracefully when distributed backends are unavailable. That fallback is useful, but it is not durable truth.

### Infrastructure shape changes runtime behavior

Features backed by KV, R2, or queues may behave differently depending on whether the binding is present in the deployed environment. The runtime model therefore includes not only source code, but binding availability.

## 3. Design Rule

When adding platform code, ask which phase owns the assumption:

- build-time assumption
- deploy-time assumption
- request-time assumption
- isolate-local assumption
- distributed-runtime assumption

If the answer is unclear, the implementation is usually missing an important guardrail.
