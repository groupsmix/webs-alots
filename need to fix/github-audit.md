# .github Directory Audit Report

## 1. SECURITY ISSUES

### Critical: PHI Encryption Key Exposure in CI Logs
**File:** `.github/workflows/rotate-phi-key.yml` (Lines 7-9)
- **What's wrong:** The workflow requests the new 64-character PHI encryption key via `workflow_dispatch` inputs (`inputs.new_key`).
- **Why it's a problem:** GitHub Actions inputs are logged in plaintext and visible in the run's UI to anyone with read access to the repository. This completely defeats the purpose of rotation and leaks your most critical encryption key.
- **Suggested fix:** Remove the `new_key` input. Instead, require an administrator to update a GitHub Secret (e.g., `NEW_PHI_ENCRYPTION_KEY`), and have the workflow read from that secret instead of `inputs.new_key`. 

### High: Database Credential Leak via `postgres://` Scheme
**File:** `.github/workflows/backup.yml` (Line 78)
- **What's wrong:** The regex intended to mask connection errors only targets `postgresql://` (`sed 's|postgresql://[^:]*:[^@]*@|postgresql://***:***@|g'`). 
- **Why it's a problem:** Supabase often provisions connection strings starting with `postgres://` (without the `ql`). If your `SUPABASE_DB_URL` uses the `postgres://` scheme, the regex will fail to match, and a connection error will log the unmasked connection string (including the password) directly to the GitHub Actions console.
- **Suggested fix:** Update the sed regex to support both schemes: `sed 's|postgres\(ql\)\?://[^:]*:[^@]*@|postgres\1://***:***@|g'`

---

## 2. BLOCKERS

### High: Global `pip install` Breakage on Ubuntu 24.04 (PEP 668)
**Files:** 
- `.github/workflows/backup.yml` (Lines 86 & 255) -> `pip install awscli`
- `.github/workflows/ci.yml` (Line 597) -> `python3 -m pip install --upgrade semgrep`
- **What's wrong:** Since GitHub updated `ubuntu-latest` to Ubuntu 24.04, PEP 668 (externally managed environments) is enforced. Running a global `pip install` outside a virtual environment will throw a hard error and fail the workflow.
- **Why it's a problem:** These commands will break the `backup` and `ci` workflows completely. Furthermore, `awscli` is already pre-installed on GitHub-hosted Ubuntu runners, so trying to install it is both redundant and destructive.
- **Suggested fix:** 
  - In `backup.yml`: Completely remove the `pip install awscli` steps (it's pre-installed).
  - In `ci.yml`: Replace the pip command with `pipx install semgrep` or use the official `returntocorp/semgrep-action`.

---

## 3. BUGS & ERRORS

### Medium: Grouped Dependabot PRs Never Auto-Merge
**File:** `.github/workflows/dependabot-auto-merge.yml` (Line 27)
- **What's wrong:** The classification script parses the PR title using a strict regex: `/ from X to Y/`. 
- **Why it's a problem:** When Dependabot groups multiple updates (as configured in your `dependabot.yml` `npm-minor-patch` group), it uses titles like `"Bump the npm-minor-patch group with 3 updates"`. The regex will fail, evaluating as an `"unparsed-title"`, which skips the auto-merge step. Grouped PRs will sit indefinitely waiting for manual merges.
- **Suggested fix:** Update the script to detect grouped Dependabot PR titles (e.g., matching `/Bump the .* group/`) or use GitHub's official native dependabot auto-merge configurations / CLI label checks instead of regexing the title.

### Low: False Positive Security Issues
**File:** `.github/workflows/subdomain-orphan-scan.yml` (Line 60)
- **What's wrong:** The issue creation step uses `if: failure() && steps.preflight.outputs.secrets_ok == 'true'`.
- **Why it's a problem:** If the Node script fails due to a network timeout, an `npm ci` failure, or a syntax error, this step triggers and opens a High-Priority Security Issue stating "Orphaned subdomains detected". This creates panic for infrastructure flakes.
- **Suggested fix:** Give the execution step an ID (e.g., `id: scan`), output a specific flag if orphans are found, and check for that specific output flag (e.g., `if: steps.scan.outputs.orphans_found == 'true'`).

---

## 4. PERFORMANCE & CODE QUALITY

### Low: Hardcoded Node.js Versions Across Workflows
**Files:** `deploy.yml` (Line 74), `ci.yml` (Lines 35, 498, 639, 766, 843), `migration-check.yml` (Line 78), etc.
- **What's wrong:** Workflows hardcode `node-version: "22.13"` or `node-version: 22`. 
- **Why it's a problem:** This causes drift. You already have a `.nvmrc` file (correctly utilized by `ai-evals.yml`). When you upgrade Node, you'll have to find and replace it across a dozen workflows, and forgetting one can lead to silent discrepancies between environments.
- **Suggested fix:** Standardize all `actions/setup-node` configurations to use `node-version-file: ".nvmrc"`.
