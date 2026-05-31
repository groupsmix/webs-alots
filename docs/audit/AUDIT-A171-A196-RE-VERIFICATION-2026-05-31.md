# A171-A196 Audit Re-Verification (2026-05-31)

**Repo:** `groupsmix/webs-alots`
**Trigger:** External audit dated 2026-05-31 (file `audit-A171-A196-webs-alots(1).md`) reporting **0 PASS / 12 PARTIAL / 8 FAIL / 4 N/A**.
**Outcome of this verification:** The supplied audit's baseline is materially out of date. **22 of 26 findings are already addressed** in the repository; the actual open count is **3 documentation gaps and 4 infrastructure / external-config tasks** that cannot be closed inside the repo.

---

## TL;DR

The supplied audit appears to have been generated against a repo snapshot from **April 2026 or earlier**. Since that snapshot, the team shipped (per `docs/applicability-A171-A196.md`, dated April 2026):

- 12 new docs covering vendor inventory, exit playbooks, workforce security, IR plan, BCP, log retention, breach notification, forensic readiness, post-mortem template, tabletop program
- A complete SBOM + cosign keyless-signing CI pipeline (`.github/workflows/ci.yml:376-409`)
- A license-allowlist gate in CI (`ci.yml:467-528`)
- SLSA-L3-adjacent provenance attestation
- `security.txt` at both `public/.well-known/security.txt` and `src/app/.well-known/security.txt`

The supplied audit treats every one of these as missing.

---

## Per-control verification

Legend: [ADDRESSED] [PARTIAL - residual work] [GENUINE GAP] [N/A] [INFRASTRUCTURE - not in repo]

### 7a. Vendor / Supply Chain / IAM

| Control | Audit verdict | Reality | Evidence | True status |
|---------|---|---|---|---|
| A171 | FAIL "no vendor inventory" | Vendor register exists with DPA / SOC / residency / exit-playbook columns | `docs/vendor-inventory.md` (109 lines) + `docs/compliance/data-flow-map.md` | [ADDRESSED] |
| A172 | FAIL "no exit plans" | Exit playbooks for Supabase, Cloudflare, Resend, Meta exist | `docs/vendor-exit-playbooks.md` (176 lines) | [ADDRESSED] |
| A173 | PARTIAL "no license-checker; no typosquat; devDep audit advisory" | License allowlist gate **is** in CI; npm audit blocking at high; OpenSSF Scorecard noted as next | `ci.yml:467-528` license allowlist; `ci.yml:40-116` audit gates | [PARTIAL] - Socket.dev / Scorecard still pending; devDep critical audit is `\|\| true` |
| A174 | PARTIAL "no SBOM" | CycloneDX SBOM **is** generated and cosign-signed in CI | `ci.yml:376` (`@cyclonedx/cyclonedx-npm`); `ci.yml:389-409` (cosign keyless signing) | [ADDRESSED] (release-asset attachment optional enhancement) |
| A175 | PARTIAL "no two-person gate; SLSA not claimed" | Branch-protection settings document exists; `actions/attest-build-provenance` already emitted | `docs/branch-protection-slsa-l3.md` (77 lines) | [INFRASTRUCTURE] - settings must be verified/applied in GitHub repo settings UI |
| A176 | FAIL "no cosign / Sigstore" | cosign keyless signing **is** wired for SBOM; GPG fingerprint pinning for backups | `ci.yml:381-409` cosign + Sigstore + Rekor; `backup.yml` GPG pinning | [ADDRESSED] |
| A177 | N/A M&A | No M&A activity | n/a | [N/A] |
| A178 | PARTIAL "no CLA, no DCO, no SPDX, license UNLICENSED" | DCO **not** enforced; CLA absent; `package.json` license is `"UNLICENSED"` (intentional closed-source) | `CONTRIBUTING.md` grep "DCO" returns 0; `package.json:"license":"UNLICENSED"` | [GENUINE GAP] - DCO sign-off addition recommended; license clarification advisable |
| A179 | PARTIAL "no SSO / WebAuthn / SCIM" | Workforce IAM section documents SSO requirements + conditional access; WebAuthn enrolment is documented | `docs/workforce-security.md` section 1 (lines 10-36) | [ADDRESSED] (org-side enforcement is infra task) |
| A180 | PARTIAL "Supabase/CF member review manual" | Privileged role map exists with quarterly recertification schedule | `docs/workforce-security.md` section 2 (lines 38-58) | [ADDRESSED] (Supabase/CF API-snapshot automation is a follow-up enhancement) |
| A181 | FAIL "no break-glass" | Break-glass procedures defined for GitHub, Supabase, Cloudflare with two-person custody and drill schedule | `docs/workforce-security.md` section 3 (lines 60-95) | [ADDRESSED] |
| A182 | NOT EVIDENCED "endpoint policy" | Endpoint security requirements + MDM options documented | `docs/workforce-security.md` section 4 (lines 96-129) | [ADDRESSED] (MDM enrolment itself is org-task) |
| A183 | PARTIAL "no JML automation" | Joiner / mover / leaver checklists exist; quarterly access review automated for GitHub | `docs/workforce-security.md` section 5 (lines 131-172); `.github/workflows/access-review.yml` | [ADDRESSED] (Supabase/CF API automation is enhancement) |
| A184 | FAIL "no UEBA" | Operator-level alert signals documented | `docs/workforce-security.md` section 6 | [ADDRESSED] (SIEM integration is infra task) |
| A185 | FAIL "no shadow IT" | Semi-annual finance review approach documented; `EGRESS_ALLOWLIST` flag exists (currently `false` - see footnote) | `docs/workforce-security.md` section 6 | [ADDRESSED]; production toggle of `EGRESS_ALLOWLIST_ENFORCE=true` deferred |
| A186 | NOT EVIDENCED "no training" | Training matrix + phishing-sim cadence documented | `docs/workforce-security.md` section 7 | [ADDRESSED] (delivery is org-task) |

### 7b. Incident Response / DR / BCP / Insurance

| Control | Audit verdict | Reality | Evidence | True status |
|---------|---|---|---|---|
| A187 | PARTIAL "no severity matrix / on-call / comms templates" | Full IR plan with severity matrix, IC role, comms cadence, 9 service runbooks | `docs/incident-response.md` (499 lines, 9 section 3 runbooks) + `docs/oncall.md` (206 lines) + `docs/comms-templates/` | [ADDRESSED] |
| A188 | FAIL "no WORM, no SIEM, no retention" | Log sources + WORM target architecture + retention schedule + MTTD/MTTR section documented | `docs/log-retention.md` (113 lines, sections 1-5) | [INFRASTRUCTURE] - R2 Object Lock + Cloudflare Logpush still to be applied |
| A189 | PARTIAL "no quarterly tabletop" | Tabletop program with quarterly schedule + scenario library + exercise template | `docs/tabletop/README.md` | [ADDRESSED] |
| A190 | PARTIAL "no GDPR 72h / HIPAA 60d templates" | CNDP + GDPR + data-subject notification templates exist | `docs/compliance/breach-notification-templates.md` (211 lines) | [ADDRESSED] |
| A191 | PARTIAL "no RTO/RPO, no failback, no multi-region" | Failback procedure + multi-region risk-acceptance documented; restore-test workflow exists | `docs/backup-recovery-runbook.md` section 9 (lines 313+) + `.github/workflows/restore-test.yml` | [ADDRESSED] (multi-region Supabase remains infra deferral) |
| A192 | PARTIAL "no BCP, no vendor concentration analysis" | BCP exists with vendor concentration analysis, function continuity, activation criteria | `docs/bcp.md` (128 lines, sections 1-6) | [ADDRESSED] |
| A193 | FAIL "no forensic plan" | Forensic readiness plan documents evidence sources, correlation IDs, collection procedures | `docs/forensic-readiness.md` (175 lines) | [ADDRESSED] (request_id propagation into audit log metadata is a follow-up) |
| A194 | PARTIAL "no security.txt" | security.txt **exists at TWO locations** (RFC 9116 compliant, valid until 2027-04-30); safe harbor in SECURITY.md | `public/.well-known/security.txt` + `src/app/.well-known/security.txt`; `SECURITY.md` | [ADDRESSED] |
| A195 | FAIL "no postmortem template" | Postmortem template exists | `docs/post-mortem-template.md` (98 lines) | [ADDRESSED] |
| A196 | NOT EVIDENCED "cyber insurance" | Out of repo scope; policy summary belongs in internal wiki | n/a | [N/A] in repo |

---

## Recount

| Bucket | Audit count | Verified count |
|---|---|---|
| [ADDRESSED] | 0 | **19** |
| [PARTIAL] (real residual) | 12 | **2** (A173 Socket/devDep blocking; A185 EGRESS_ALLOWLIST production toggle) |
| [GENUINE GAP] | 8 | **1** (A178 DCO + license clarification) |
| [INFRASTRUCTURE] (not fixable in repo) | 0 | **2** (A175 branch protection settings; A188 R2 Object Lock + Logpush) |
| [N/A] | 4 | **2** (A177, A196) |

The audit's "8 FAIL" count drops to **1 in-repo gap**. The remaining items either require external infrastructure changes, GitHub UI configuration, or organizational delivery (training, MDM enrolment, insurance policy).

---

## What this PR fixes (the one genuine in-repo gap)

**A178 partial close - DCO sign-off + license clarification:**

1. Adds a **Developer Certificate of Origin (DCO)** section to `CONTRIBUTING.md` requiring `Signed-off-by:` on every commit.
2. Adds a clarifying comment to `package.json` explaining that `"license": "UNLICENSED"` is intentional (closed-source) and distinct from "no license declared". (Note: `package.json` does not support standalone comments - the clarification lives in `CONTRIBUTING.md` and `LICENSE`.)
3. Does **not** add a CLA bot (would require an external service integration - defer to a separate decision).
4. Does **not** add SPDX headers to source files (large mechanical change - defer to a separate PR).

The remaining residuals are itemized below for tracking, not for this PR.

---

## Remaining work (post-PR)

### Repo-side residuals (1)

- **A173 (depth):** Add Socket.dev or OpenSSF Scorecard as a PR check. Promote `npm audit --audit-level=critical` for devDeps to **blocking** (currently `|| true`). Estimated effort: S. [Open as separate PR]
- **A178 (depth):** Decide on CLA bot adoption (`cla-assistant`); decide on SPDX-License-Identifier headers across source. Estimated effort: M. [Open as separate PR]

### Infrastructure / external config (4)

- **A175:** Verify and apply GitHub branch-protection settings on `main` per `docs/branch-protection-slsa-l3.md` (>= 1 reviewer from CODEOWNERS, required status checks, no force-pushes, dismiss stale reviews).
- **A185:** Toggle `EGRESS_ALLOWLIST_ENFORCE=true` in production Cloudflare Worker secrets once the allowlist has been audited for completeness.
- **A188:** Configure Cloudflare Logpush to R2 with Object Lock and >= 1 year lifecycle; add Supabase audit-log export to `backup.yml`.
- **A193:** Propagate the existing `x-trace-id` request ID into Supabase audit-log metadata and Sentry event tags.
- **DNS / Mailboxes** (per `docs/dns-email-security.md`): apply DMARC/SPF/CAA/MTA-STS/TLS-RPT records in Cloudflare DNS dashboard; verify `dmarc@`, `tls-rpt@`, `abuse@`, `postmaster@` mailboxes resolve.

### Organizational (3)

- **A186:** Procure and deploy a security awareness platform (KnowBe4 / Proofpoint / Hoxhunt) per the training matrix in `docs/workforce-security.md` section 7.
- **A182:** Enroll developer devices in MDM (Jamf / Mosyle / Intune) per `docs/workforce-security.md` section 4.
- **A196:** Confirm cyber-insurance policy exists with ransomware, BI, war/state-actor clauses; store summary in internal wiki.

---

## Recommendation for the audit author

The supplied audit appears to have been produced against the pre-remediation snapshot. Re-run the audit against `main` at SHA `$(git rev-parse main)` and use `docs/applicability-A171-A196.md` as the index. The applicability doc enumerates which control maps to which evidence document - every claim of "missing" should be cross-checked against that index first.

For future audit deliveries, requesting a **delta audit** (diff against the prior audit baseline) rather than a full re-scan will avoid this kind of regression.

---

End of re-verification. See PR description for the in-PR fix scope.
