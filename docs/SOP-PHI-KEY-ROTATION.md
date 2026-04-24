# Standard Operating Procedure (SOP): PHI Key Rotation

## Overview
This document outlines the procedure for rotating the `PHI_ENCRYPTION_KEY` used to encrypt Patient Health Information (PHI) stored in Cloudflare R2.
Under Moroccan Law 09-08 and GDPR, encryption keys must be rotated periodically or immediately upon suspected compromise.

## Prerequisites
- Super-admin access to the GitHub repository (to trigger workflows).
- Access to the Cloudflare dashboard (to update Worker secrets).
- Ensure no major batch uploads are happening during the rotation window.

## Procedure
1. **Generate a New Key:**
   Generate a new 64-character hexadecimal key (256 bits).
   ```bash
   openssl rand -hex 32
   ```

2. **Trigger the Key Rotation Workflow:**
   Navigate to the GitHub Actions tab in the repository.
   Select the **Rotate PHI Encryption Key** workflow.
   Click **Run workflow**.
   You will be prompted to enter the **New PHI Encryption Key**.
   This workflow executes `scripts/rotate-phi-key.ts`, which downloads all encrypted R2 objects using the old key and re-encrypts them with the new key.

3. **Update the Environment Variable:**
   Once the workflow completes successfully, update the `PHI_ENCRYPTION_KEY` secret in Cloudflare Workers:
   ```bash
   echo "<NEW_KEY>" | npx wrangler secret put PHI_ENCRYPTION_KEY --env production
   ```
   *Note: Also update the key in your local `.env` and staging environments if applicable.*

4. **Verify Access:**
   Log into the application as a doctor or clinic admin and attempt to download an existing PHI document (e.g., a radiology report or prescription) to ensure it decrypts correctly.

## Rollback
If the rotation script fails midway, it will log the last successfully rotated file. You can resume the script from that file, or if data is corrupted, restore from the nightly encrypted `pg_dump` and R2 backups.
