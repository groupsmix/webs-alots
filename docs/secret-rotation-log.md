# Secret Rotation Log

Track every secret rotation here. The `scripts/check-secret-rotation.sh`
script reads this file to determine which secrets are due for rotation.

## Format

Each row records a rotation event. The script parses the **Date** column
and the **Secret** column to calculate rotation age.

## Log

| Date       | Secret                  | Rotated By | Notes                 |
| ---------- | ----------------------- | ---------- | --------------------- |
| 2026-05-28 | BOOKING_TOKEN_SECRET    | Initial    | Set during deployment |
| 2026-05-28 | R2_SIGNED_URL_SECRET    | Initial    | Set during deployment |
| 2026-05-28 | PROFILE_HEADER_HMAC_KEY | Initial    | Set during deployment |
| 2026-05-28 | CRON_SECRET             | Initial    | Set during deployment |
| 2026-05-28 | PHI_ENCRYPTION_KEY      | Initial    | Set during deployment |
| 2026-05-28 | STRIPE_SECRET_KEY       | Initial    | Set during deployment |
| 2026-05-28 | STRIPE_WEBHOOK_SECRET   | Initial    | Set during deployment |
| 2026-05-28 | CMI_SECRET_KEY          | Initial    | Set during deployment |
| 2026-05-28 | META_APP_SECRET         | Initial    | Set during deployment |
| 2026-05-28 | WHATSAPP_VERIFY_TOKEN   | Initial    | Set during deployment |
| 2026-05-28 | RESEND_API_KEY          | Initial    | Set during deployment |
| 2026-05-28 | OPENAI_API_KEY          | Initial    | Set during deployment |
| 2026-05-28 | CLOUDFLARE_AI_API_TOKEN | Initial    | Set during deployment |
| 2026-05-28 | R2_ACCESS_KEY_ID        | Initial    | Set during deployment |
| 2026-05-28 | R2_SECRET_ACCESS_KEY    | Initial    | Set during deployment |
