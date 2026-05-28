# PHI Encryption Key Custody Log

**Purpose:** Record every rotation of `PHI_ENCRYPTION_KEY` for compliance traceability.
Do NOT record the key itself — only the metadata below.

| Date         | Reason          | Custodian A | Custodian B | Rotation Method         | Verified |
| ------------ | --------------- | ----------- | ----------- | ----------------------- | -------- |
| _2026-05-28_ | _Initial setup_ | _Name A_    | _Name B_    | _Manual (openssl rand)_ | _☐_      |

## Instructions

1. After each key rotation, add a row to the table above.
2. Both custodians must sign off (mark Verified as ☑) within 24 hours.
3. If a custodian leaves the organization, immediately rotate the key and
   assign a replacement custodian.
4. This file must be committed to the repo (it contains no secrets).
