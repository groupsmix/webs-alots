#!/usr/bin/env bash
#
# Heuristic first-pass scanner for tenant-isolation and PHI-security red flags
# in the Oltigo Health codebase. Pattern-matching only — it does not
# understand the code, so it WILL produce false positives and WILL miss real
# issues. Always finish with the manual checklist in SKILL.md / references/checklist.md.
#
# Usage:
#   scripts/scan.sh file1.ts file2.sql ...
#   scripts/scan.sh                       # scans `git diff --name-only HEAD`

set -uo pipefail

FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  mapfile -t FILES < <(git diff --name-only HEAD -- '*.ts' '*.tsx' '*.sql' 2>/dev/null)
fi
if [ ${#FILES[@]} -eq 0 ]; then
  mapfile -t FILES < <(git diff --name-only --cached -- '*.ts' '*.tsx' '*.sql' 2>/dev/null)
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No files to scan. Pass file paths explicitly, or run inside a git repo with staged/unstaged changes."
  exit 0
fi

hits=0

flag() {
  echo "  [$1] $2:$3"
  hits=$((hits + 1))
}

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue

  case "$f" in
    *.ts | *.tsx)
      # 1. Mass assignment via spread into a mutation
      while IFS=: read -r ln _rest; do
        flag "MASS-ASSIGNMENT" "$f" "$ln"
      done < <(grep -nE '\.(insert|update|upsert)\(\s*\{\s*\.\.\.' "$f")

      # 2. .from( calls with no nearby clinic_id reference (heuristic window)
      while IFS=: read -r ln _rest; do
        ctx=$(sed -n "${ln},$((ln + 6))p" "$f")
        if ! grep -q 'clinic_id' <<<"$ctx"; then
          flag "MISSING-CLINIC-SCOPE?" "$f" "$ln"
        fi
      done < <(grep -n '\.from(' "$f")

      # 3. Raw console.log (should use @/lib/logger)
      while IFS=: read -r ln _rest; do
        flag "RAW-CONSOLE-LOG" "$f" "$ln"
      done < <(grep -n 'console\.\(log\|info\|warn\|error\)' "$f")

      # 4. Webhook-looking files with no signature check
      if grep -qiE 'webhook|whatsapp' <<<"$f"; then
        if ! grep -qiE 'signature|hmac' "$f"; then
          flag "WEBHOOK-NO-SIGNATURE-CHECK?" "$f" "-"
        fi
      fi

      # 5. File-upload-looking code with no encryption import
      if grep -qiE 'upload|r2|patient.*file' "$f"; then
        if ! grep -q '@/lib/encryption' "$f"; then
          flag "PHI-UPLOAD-NO-ENCRYPTION-IMPORT?" "$f" "-"
        fi
      fi
      ;;

    *.sql)
      if ! grep -qiE 'IF NOT EXISTS|IF EXISTS' "$f"; then
        flag "MIGRATION-MISSING-GUARD" "$f" "-"
      fi
      if grep -qi 'CREATE TABLE' "$f" && ! grep -qiE 'ROW LEVEL SECURITY|POLICY' "$f"; then
        flag "NEW-TABLE-NO-RLS?" "$f" "-"
      fi
      ;;
  esac
done

echo
if [ "$hits" -eq 0 ]; then
  echo "No heuristic red flags found. Still complete the manual checklist — this script cannot verify judgment calls."
else
  echo "$hits potential issue(s) flagged above. Expect some false positives — verify each against SKILL.md / references/checklist.md."
fi
