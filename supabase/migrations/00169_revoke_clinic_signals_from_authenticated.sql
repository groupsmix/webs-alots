-- Security Audit Remediation: Remove broad execution grant on admin analytics
-- The function `get_all_clinic_signals()` already has an internal `is_super_admin()` guard,
-- but revoking EXECUTE from `authenticated` provides defense-in-depth and ensures
-- it can only be invoked via a service-role context.

REVOKE EXECUTE ON FUNCTION get_all_clinic_signals() FROM authenticated;
