# Software Bill of Materials (SBOM)
## Finding F-A196 — Supply Chain Transparency

> **Format:** SPDX 2.3 (human-readable summary). Machine-readable SPDX JSON generated via `npm run sbom:generate`.  
> **Last generated:** 2025-05-08  
> **Generator:** `@cyclonedx/cdxgen` / `npm sbom`

---

## Generation Commands

```bash
# Generate CycloneDX JSON SBOM (recommended — supported by Dependency-Track)
npx @cyclonedx/cdxgen --output-format JSON --output-file docs/sbom-$(date +%Y-%m-%d).cdx.json

# Generate SPDX JSON via npm (Node 18+)
npm sbom --sbom-format spdx --sbom-type package > docs/sbom-$(date +%Y-%m-%d).spdx.json

# Upload to Dependency-Track for continuous monitoring
curl -X POST "https://dtrack.internal/api/v1/bom" \
  -H "X-Api-Key: $DTRACK_API_KEY" \
  -F "project=$DTRACK_PROJECT_ID" \
  -F "bom=@docs/sbom-$(date +%Y-%m-%d).cdx.json"
```

Add to CI pipeline (`.github/workflows/ci.yml`):
```yaml
- name: Generate SBOM
  run: npx @cyclonedx/cdxgen --output-format JSON --output-file sbom.cdx.json
- name: Upload SBOM artifact
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.cdx.json
    retention-days: 90
```

---

## SPDX Document Information

| Field | Value |
|---|---|
| SPDXVersion | SPDX-2.3 |
| DataLicense | CC0-1.0 |
| SPDXID | SPDXRef-DOCUMENT |
| DocumentName | oltigo-health-sbom |
| DocumentNamespace | https://oltigo.com/sbom/2025-05-08 |
| Creator | Tool: npm-sbom v1.0 |
| Created | 2025-05-08T00:00:00Z |

---

## Package Summary (Top-Level Direct Dependencies)

| Package | Version | License | Supplier |
|---|---|---|---|
| next | 16.x | MIT | Vercel, Inc. |
| react | 19.x | MIT | Meta Platforms, Inc. |
| react-dom | 19.x | MIT | Meta Platforms, Inc. |
| typescript | 5.x | Apache-2.0 | Microsoft Corporation |
| @supabase/supabase-js | 2.x | MIT | Supabase Inc. |
| @supabase/ssr | 0.x | MIT | Supabase Inc. |
| stripe | 17.x | MIT | Stripe, Inc. |
| zod | 3.x | MIT | Colin McDonnell |
| @sentry/nextjs | 9.x | MIT | Functional Software, Inc. (Sentry) |
| isomorphic-dompurify | 2.x | Apache-2.0 | Timo Tijhof |
| lucide-react | 0.x | ISC | Lucide Contributors |
| resend | 4.x | MIT | Resend Inc. |
| @cloudflare/workers-types | 4.x | Apache-2.0 | Cloudflare, Inc. |
| openai | 4.x | Apache-2.0 | OpenAI |
| vitest | 3.x | MIT | Evan You / Vitest contributors |
| @playwright/test | 1.x | Apache-2.0 | Microsoft Corporation |

> Full transitive dependency tree in `docs/sbom-YYYY-MM-DD.cdx.json` (generated per release).

---

## Integrity Verification

Each release artifact should be verified against its published checksum:

```bash
# Verify npm package integrity (uses lockfile SRI hashes)
npm ci --audit

# Spot-check a specific package
npm view next dist.integrity
```

---

## Known Overrides (Transitive Dependency Pins)

See `package.json → overrides` and `_overrides_rationale` for the current list of pinned transitive dependencies. Each entry includes a CVE reference and removal condition.

---

## Vulnerability Monitoring

| Tool | Cadence | Channel |
|---|---|---|
| `npm audit` | Every CI run | Blocks merge on HIGH+ |
| GitHub Dependabot | Daily | Auto-PR |
| Snyk | Weekly | #security Slack |
| OSSAR (GitHub Advanced Security) | Every push | GitHub Security tab |

---

## SBOM Archive Policy

Generated SBOMs are retained for 7 years in `docs/sbom-archive/` (or R2 if file size exceeds 10 MB) to satisfy:
- Moroccan Law 09-08 data processing records
- Potential software liability claims
- Incident response (identify which version was running at time of breach)
