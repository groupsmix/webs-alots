# Health SaaS Platform

Multi-tenant health management platform for **doctors**, **dentists**, and **pharmacies** in Morocco.

Built with **Next.js 16** (App Router) + **Supabase** + **Cloudflare Workers** (via [OpenNext](https://opennext.js.org/cloudflare)).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| Notifications | WhatsApp Business API (Meta Cloud API) |
| Hosting | Cloudflare Workers (via OpenNext) |
| Payments | CMI Payment Gateway (optional) |

## User Roles

1. **Super Admin** - Controls everything across all clients
2. **Clinic Admin** - Doctor or clinic owner
3. **Receptionist** - Manages bookings and patients daily
4. **Doctor** - Sees their own patients only
5. **Patient** - Books, sees history, uploads files

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and WhatsApp credentials

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the public website.

## Project Structure

```
src/
  app/
    (public)/          # Public website (no login required)
    (auth)/            # Login, register, OTP
    (patient)/         # Patient portal
    (doctor)/          # Doctor dashboard
    (receptionist)/    # Reception panel
    (admin)/           # Clinic admin panel
    (super-admin)/     # Master control panel
    api/               # Webhooks and API routes
  components/
    public/            # Website sections (hero, services...)
    booking/           # Calendar, time slots, forms
    patient/           # Portal UI components
    doctor/            # Dashboard UI components
    receptionist/      # Reception UI components
    admin/             # Admin panels UI
    ui/                # shadcn shared components
  lib/
    supabase-client.ts # Browser Supabase client
    supabase-server.ts # Server + RSC client
    whatsapp.ts        # WhatsApp API wrapper
    utils.ts           # Helpers, formatters
  config/
    clinic.config.ts   # Per-client configuration (only file you change)
    theme.config.ts    # Colors, fonts, logo path
supabase/
  migrations/          # SQL schema (run once)
  functions/           # Supabase Edge Functions
```

## Multi-Tenant Architecture

All clinics share one Supabase project. Data isolation is enforced via **Row Level Security (RLS)** - every table has a `clinic_id` column and RLS policies automatically filter queries.

### Subdomain Routing

Each clinic is accessible at `clinicname.yourdomain.com`. The middleware extracts the subdomain, looks up the clinic in Supabase, and injects tenant info into request headers for all downstream pages and API routes.

**Setup:**

1. Add a `subdomain` value to each clinic row in the `clinics` table (run migration `00004_add_clinic_subdomain.sql`)
2. Set `ROOT_DOMAIN=yourdomain.com` in `.env.local`
3. Configure a wildcard DNS record: `*.yourdomain.com → your server`

For local development, subdomains work automatically via `*.localhost` (e.g., `demo.localhost:3000`).

**How it works:**

- `middleware.ts` extracts the subdomain and queries the `clinics` table
- Resolved clinic info is passed via `x-tenant-*` headers
- Server Components use `getTenant()` from `src/lib/tenant.ts`
- Client Components use `useTenant()` from `src/components/tenant-provider.tsx`
- Unknown subdomains redirect to the root domain

## Per-Client Deployment

To deploy for a new client, only edit `src/config/clinic.config.ts` with their details (name, contact, features, working hours).

## Database

Run the initial migration against your Supabase project:

```bash
# Using Supabase CLI
supabase db push
```

## File Storage (Cloudflare R2)

Images and documents (clinic logos, doctor photos, patient files) are stored in **Cloudflare R2** — S3-compatible with no egress fees.

### Setup

1. Create an R2 bucket in your Cloudflare dashboard
2. Create an R2 API token with read/write permissions
3. Add env vars to `.env.local`:

| Variable | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET_NAME` | Bucket name (e.g., `webs-alots-uploads`) |
| `R2_PUBLIC_URL` | Public URL for the bucket (custom domain or `.r2.dev` URL) |

### API Endpoints

- **`POST /api/upload`** — Server-side upload (multipart form data: `file`, `category`, `clinicId`)
- **`GET /api/upload?filename=...&contentType=...&category=...&clinicId=...`** — Get a pre-signed URL for direct browser upload

### Usage in Code

```typescript
import { uploadToR2, buildUploadKey } from "@/lib/r2";

const key = buildUploadKey(clinicId, "logos", "clinic-logo.png");
const url = await uploadToR2(key, buffer, "image/png");
```

## Production Security Checklist

Before deploying to production, complete these steps:

### 1. Remove or re-password seed users

Migration `00019` creates seed users with a well-known default password (`seed-password-change-me`). In production you **must** either:

- **Delete the seed accounts** from `auth.users` and `public.users`, or
- **Change their passwords** via the Supabase Dashboard (Authentication > Users).

To use a custom password during migration instead of the default, set the PostgreSQL variable before running the migration:

```sql
SET app.seed_user_password = 'your-strong-random-password';
```

### 2. Verify CSRF protection is active

The middleware enforces Origin-header checks on all mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) to API routes. Ensure `NEXT_PUBLIC_SITE_URL` is set correctly in your environment so that legitimate requests are not blocked.

## Documentation

| Document | Description |
|---|---|
| [WhatsApp Template Approval Guide](docs/whatsapp-template-approval.md) | How to submit and manage WhatsApp message templates for Meta Business API approval — includes all 10 Darija templates with variable mappings |
| [API Docs (generated)](docs/api/) | Auto-generated TypeDoc API reference for `src/lib/` utilities (run `npm run docs:generate` to rebuild) |

## Deploy on Cloudflare Workers

This project deploys as a **Cloudflare Worker** using [OpenNext for Cloudflare](https://opennext.js.org/cloudflare), **not** Cloudflare Pages. The build produces a Worker bundle (`.open-next/worker.js`) and static assets (`.open-next/assets/`), both served by the Workers runtime.

> **Note:** A Cloudflare Pages project is also connected to this repo. The Pages output directory (`destination_dir`) is configured via the Cloudflare dashboard/API to `.open-next/assets`. Do **not** add `pages_build_output_dir` to `wrangler.toml` — the `ASSETS` binding name used by OpenNext is reserved by Pages and will cause the build to fail.

### Manual Deploy

```bash
npm run deploy
```

### Staging Deploy

```bash
# Deploy to the staging worker
npm run build:cf && wrangler deploy --env staging
```

Staging uses a separate Supabase project for data isolation. Set `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY` in GitHub Actions secrets.

### Auto-Deploy via GitHub Actions

Pushes to `main` and `staging` automatically build and deploy to Cloudflare Workers. Add these secrets in your GitHub repo settings (**Settings > Secrets and variables > Actions**):

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (used at build time) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (used at build time) |
| `STAGING_SUPABASE_URL` | Staging Supabase project URL (staging branch only) |
| `STAGING_SUPABASE_ANON_KEY` | Staging Supabase anon key (staging branch only) |
