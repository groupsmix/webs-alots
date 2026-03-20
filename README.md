# Health SaaS Platform

Multi-tenant health management platform for **doctors**, **dentists**, and **pharmacies** in Morocco.

Built with **Next.js 16** (App Router) + **Supabase** + **Cloudflare Pages**.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| Notifications | WhatsApp Business API (Meta Cloud API) |
| Hosting | Cloudflare Pages (free) |
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
cp .env.local.example .env.local
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

## Per-Client Deployment

To deploy for a new client, only edit `src/config/clinic.config.ts` with their details (name, contact, features, working hours).

## Database

Run the initial migration against your Supabase project:

```bash
# Using Supabase CLI
supabase db push
```

## Deploy on Cloudflare Workers

### Manual Deploy

```bash
npm run deploy
```

### Auto-Deploy via GitHub Actions

Pushes to `main` automatically build and deploy to Cloudflare Workers. Add these secrets in your GitHub repo settings (**Settings > Secrets and variables > Actions**):

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (used at build time) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (used at build time) |
