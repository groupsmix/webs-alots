# Third-Party Licenses
## Finding F-A197

> Auto-generated reference for open-source dependencies.  
> Run `npm run licenses:generate` to refresh.  
> Last updated: 2025-05-08

---

## License Summary

| License | Count | Examples |
|---|---|---|
| MIT | ~120 | next, react, typescript, zod, tailwindcss |
| Apache-2.0 | ~15 | @sentry/nextjs, isomorphic-dompurify |
| BSD-2-Clause | ~8 | bcryptjs, node-forge |
| BSD-3-Clause | ~5 | qs |
| ISC | ~10 | semver, glob, graceful-fs |
| CC0-1.0 | ~3 | mdn-data |
| 0BSD | ~2 | tslib |
| UNLICENSED | 1 | webs-alots (this project) |

> ⚠️ No GPL, LGPL, AGPL, or EUPL dependencies are permitted in production builds (copyleft risk). Run `npm run licenses:check` in CI to enforce.

---

## Notable Dependencies

### Next.js (MIT)
Copyright (c) 2016-present Vercel, Inc.  
License: https://github.com/vercel/next.js/blob/canary/license.md

### React (MIT)
Copyright (c) Meta Platforms, Inc. and affiliates.  
License: https://github.com/facebook/react/blob/main/LICENSE

### Supabase JS (MIT)
Copyright (c) 2021 Supabase  
License: https://github.com/supabase/supabase-js/blob/master/LICENSE

### Stripe Node (MIT)
Copyright (c) Stripe, Inc.  
License: https://github.com/stripe/stripe-node/blob/master/LICENSE

### Zod (MIT)
Copyright (c) 2020 Colin McDonnell  
License: https://github.com/colinhacks/zod/blob/master/LICENSE

### DOMPurify / isomorphic-dompurify (Apache-2.0 OR MPL-2.0)
Copyright (c) 2015 Mario Heiderich  
License: https://github.com/cure53/DOMPurify/blob/main/LICENSE

### Sentry Next.js SDK (MIT)
Copyright (c) Functional Software, Inc. dba Sentry  
License: https://github.com/getsentry/sentry-javascript/blob/develop/LICENSE

### Cloudflare Workers types (Apache-2.0)
Copyright (c) Cloudflare, Inc.  
License: https://github.com/cloudflare/workerd/blob/main/LICENSE

---

## How to Generate Full License Report

```bash
# Install license-checker
npm install -g license-checker

# Generate full report (JSON)
license-checker --production --json > docs/audit/licenses-$(date +%Y-%m-%d).json

# Check for prohibited licenses
license-checker --production --failOn "GPL;LGPL;AGPL;EUPL"
```

Add to `package.json` scripts:
```json
"licenses:generate": "license-checker --production --csv > docs/THIRD_PARTY_LICENSES.csv",
"licenses:check": "license-checker --production --failOn 'GPL;LGPL;AGPL;EUPL'"
```

---

## Patent Grant Notice

The MIT and Apache-2.0 licenses used by most dependencies include explicit or implied patent grants. If you modify and distribute this software, consult legal counsel regarding patent obligations.

---

## Compliance Obligations

| License | Attribution Required | Notice Required | Source Required |
|---|---|---|---|
| MIT | ✅ Yes | No | No |
| Apache-2.0 | ✅ Yes | ✅ Yes (NOTICE file) | No |
| BSD-2/3-Clause | ✅ Yes | No | No |
| ISC | ✅ Yes | No | No |

Attribution for production deployments is satisfied by this file and the `--production` package manifest.
