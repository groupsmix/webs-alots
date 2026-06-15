## Egress Allowlist

The platform enforces an egress allowlist to prevent compromised dependencies
from making unauthorized external API calls.

### How It Works

1. All outbound API calls use `safeFetch()` from `src/lib/fetch-wrapper.ts`
2. When `EGRESS_ALLOWLIST_ENFORCE=true`, requests to non-allowed domains are blocked
3. Allowed domains are hardcoded in `fetch-wrapper.ts`

### Adding a New External Service

1. Add the domain to `ALLOWED_DOMAINS` in `src/lib/fetch-wrapper.ts`
2. Update tests in `src/lib/__tests__/fetch-wrapper.test.ts`
3. Document the service purpose in a code comment

### Monitoring

Blocked egress attempts are logged to Sentry with context:

- Blocked hostname
- Request method
- Stack trace (to identify the calling code)
