# SOP: VAPID Key Rotation

## Overview

VAPID (Voluntary Application Server Identification) keys authenticate push notification requests.
The public key is stored in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.

## When to Rotate

- If the private key is suspected compromised
- As part of annual key rotation policy
- When migrating to a new push notification provider

## Rotation Steps

### 1. Generate new VAPID keys

```bash
npx web-push generate-vapid-keys
```

This outputs a new public/private key pair.

### 2. Update environment variables

```bash
# Production
wrangler secret put VAPID_PRIVATE_KEY
# Paste the new private key when prompted

# Staging
wrangler secret put VAPID_PRIVATE_KEY --env staging
```

Update `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `wrangler.toml` `[vars]` section
(this is public and safe to commit).

### 3. Deploy

```bash
# Deploy to staging first
wrangler deploy --env staging

# Test push notifications on staging

# Deploy to production
wrangler deploy
```

### 4. Re-subscribe clients

After key rotation, existing push subscriptions become invalid. Clients will
automatically re-subscribe on their next visit when `sw-register.tsx` detects
the key change and calls `pushManager.subscribe()` with the new public key.

### 5. Clean up old subscriptions

Old subscriptions in the `push_subscriptions` table will fail to deliver.
Run a cleanup after 30 days:

```sql
DELETE FROM push_subscriptions
WHERE updated_at < NOW() - INTERVAL '30 days';
```

## Rollback

If the new keys cause issues, revert `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in
`wrangler.toml` and re-deploy. Restore the old private key with
`wrangler secret put VAPID_PRIVATE_KEY`.

## Notes

- The public key is safe to commit to version control
- The private key must NEVER be committed — use `wrangler secret put`
- Push subscriptions are tied to the VAPID public key — rotating invalidates all existing subscriptions
- This SOP will become actionable once F-05 (/api/push/subscribe endpoint) is implemented
