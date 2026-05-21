// A2-08: Explicit opt-in for feature flags that change authn posture in production.
// If an operator enables SELF_SERVICE_REGISTRATION_ENABLED=true in production,
// the app will crash unless AUTHN_FLAGS_HASH matches the SHA-256 of the live env
// feature flag state, proving it was a deliberate change.
// gitleaks:allow -- this is a deterministic SHA-256 of public boolean feature-flag state,
// not a credential, token, or secret.

export const AUTHN_FLAGS_HASH = "6aba9d2a6ce89b121ba75e67a18a08d1ddd3b5a3d0be2483c344c8250bf72c6c"; // hash of {"NEXT_PUBLIC_PHONE_AUTH_ENABLED":"false","SELF_SERVICE_REGISTRATION_ENABLED":"false"}
