# Dashboard-Managed Domains

This guide explains how to add, remove, or change custom domains **without touching any code** — everything is managed through the Cloudflare Dashboard and your Supabase database.

## 🎯 Quick Overview

| Task | Where | Code Change? |
|------|-------|--------------|
| Add new subdomain (e.g., `new.wristnerd.xyz`) | Cloudflare Dashboard + Supabase | ❌ No |
| Add separate domain (e.g., `cryptoranked.xyz`) | Cloudflare Dashboard + Supabase | ❌ No |
| Switch domain for existing site | Supabase only | ❌ No |
| Change site configuration (colors, features) | Code (`config/sites/*.ts`) | ✅ Yes |

## 📋 How It Works

1. **Cloudflare Worker** receives traffic for any configured domain
2. **Middleware** extracts the hostname and looks up the site in the database
3. **Supabase** returns which site (slug) owns that domain
4. **App** renders the correct site based on the database record

## 🚀 Adding a New Domain

### Step 1: Add Domain to Cloudflare Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → Select your worker (`affilite-mix`)
3. Click **Settings** → **Triggers**
4. Click **Add Custom Domain**
5. Enter your domain (e.g., `crypto.wristnerd.xyz` or `cryptoranked.xyz`)
6. Click **Add Custom Domain**

### Step 2: Configure DNS (if needed)

**For subdomains of wristnerd.xyz:**
- Already handled by the wildcard `*.wristnerd.xyz` in `wrangler.jsonc`
- Just create a CNAME record in Cloudflare DNS pointing to `wristnerd.xyz`

**For separate domains (e.g., cryptoranked.xyz):**
1. Go to **Cloudflare Dashboard** → **DNS**
2. Add a CNAME record:
   - **Name**: `@`
   - **Target**: Point to your worker's custom domain
   - **Proxy**: 🟡 Orange cloud (Proxied)

### Step 3: Update Database

Connect to your Supabase SQL Editor and run:

```sql
-- Option A: Change existing site's domain
UPDATE sites 
SET domain = 'cryptoranked.xyz' 
WHERE slug = 'crypto-tools';

-- Option B: Add multiple domains to same site
-- (Useful for redirects or regional domains)
-- Note: This requires the site_domains extension table
INSERT INTO site_domains (site_id, domain, is_primary)
SELECT id, 'crypto.wristnerd.xyz', false 
FROM sites WHERE slug = 'crypto-tools';
```

### Step 4: Verify

```bash
# Check DNS is resolving
dig crypto.wristnerd.xyz

# Check site is responding
curl -H "Host: crypto.wristnerd.xyz" https://wristnerd.xyz/api/health

# Or just visit in browser
https://crypto.wristnerd.xyz
```

## 🔧 Common Scenarios

### Scenario 1: Crypto on Subdomain

Want `crypto.wristnerd.xyz` instead of `cryptoranked.xyz`?

```sql
UPDATE sites SET domain = 'crypto.wristnerd.xyz' WHERE slug = 'crypto-tools';
```

**Cloudflare:** No changes needed (wildcard `*.wristnerd.xyz` catches it)

### Scenario 2: Crypto on Separate Domain

Want to keep `cryptoranked.xyz` as the main domain?

```sql
-- Keep existing or set if different
UPDATE sites SET domain = 'cryptoranked.xyz' WHERE slug = 'crypto-tools';
```

**Cloudflare:**
1. Add `cryptoranked.xyz` as Custom Domain in Worker settings
2. Ensure DNS for `cryptoranked.xyz` points to Cloudflare

### Scenario 3: Multiple Domains Same Site

Want both `crypto.wristnerd.xyz` AND `cryptoranked.xyz`?

```sql
-- Set primary domain
UPDATE sites SET domain = 'cryptoranked.xyz' WHERE slug = 'crypto-tools';

-- Add secondary domain (if site_domains table exists)
INSERT INTO site_domains (site_id, domain, is_primary, redirect_to_primary)
SELECT id, 'crypto.wristnerd.xyz', false, true
FROM sites WHERE slug = 'crypto-tools';
```

**Cloudflare:** Add both domains as Custom Domains

### Scenario 4: Brand New Site

Adding a completely new niche site?

```sql
-- 1. Create site in database
INSERT INTO sites (slug, name, domain, language, direction, is_active)
VALUES ('coffee-tools', 'Coffee Gear', 'coffee.wristnerd.xyz', 'en', 'ltr', true);

-- 2. Create some categories
WITH coffee AS (SELECT id FROM sites WHERE slug = 'coffee-tools')
INSERT INTO categories (site_id, name, slug)
VALUES 
  ((SELECT id FROM coffee), 'Espresso Machines', 'espresso'),
  ((SELECT id FROM coffee), 'Grinders', 'grinders');
```

**Cloudflare:**
1. Add `coffee.wristnerd.xyz` as Custom Domain (or rely on wildcard)
2. Add CNAME record: `coffee` → `wristnerd.xyz`

## 🗂️ Domain Configuration Reference

### Current wrangler.jsonc Setup

```jsonc
"routes": [
  // Catches ALL subdomains: *.wristnerd.xyz
  { "pattern": "*.wristnerd.xyz", "custom_domain": true },
  // Catches root domain
  { "pattern": "wristnerd.xyz", "custom_domain": true }
  // Add other standalone domains via Dashboard
]
```

### Static Site Configs

These files define site behavior but **domain can be overridden in DB**:

- `config/sites/watch-tools.ts` - WristNerd (watches)
- `config/sites/arabic-tools.ts` - Arabic Tools (RTL, Arabic language)
- `config/sites/crypto-tools.ts` - CryptoRanked (crypto reviews)
- `config/sites/ai-compared.ts` - AI Compared (AI tools)

**Note:** The `domain` in these files is the default, but the database value takes precedence at runtime.

## 🛠️ Troubleshooting

### Domain not resolving

```bash
# Check DNS
dig +short yourdomain.com

# Check Cloudflare Worker is receiving requests
curl -v https://yourdomain.com/api/health
```

### Wrong site showing

```sql
-- Check what site the domain resolves to
SELECT s.slug, s.name, s.domain, s.is_active
FROM sites s
WHERE s.domain = 'yourdomain.com';
```

### Changes not reflecting

The middleware caches domain lookups for 5 minutes. To clear:

```sql
-- This happens automatically on site update via admin panel
-- Or restart the Cloudflare Worker (Deploy → Quick Edit → Save)
```

## 🔐 Security Notes

- The middleware validates CSRF tokens on state-changing requests
- Rate limiting is applied per IP for domain resolution
- Internal API uses a shared token to prevent enumeration

## 📚 Related Files

- `middleware.ts` - Domain resolution logic
- `wrangler.jsonc` - Worker routing configuration
- `lib/dal/sites.ts` - Database queries for sites
- `app/api/internal/resolve-site/` - Internal domain lookup API
