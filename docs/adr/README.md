# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for Oltigo Health.

## Format

Each ADR is a short markdown file:
- `0001-*.md` — First decision
- `0002-*.md` — Second decision, etc.

Status values: `Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-XXXX`

## Template

Use `docs/adr/template.md` as the starting point for new ADRs.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [0001](./0001-cloudflare-workers-opennext.md) | Deploy on Cloudflare Workers via OpenNext | Accepted | 2024-01-15 |
| [0002](./0002-supabase-multitenant-rls.md) | Supabase with Row-Level Security for Multi-Tenancy | Accepted | 2024-01-15 |
| [0003](./0003-phi-encryption-aes-gcm-r2.md) | PHI Encryption: AES-256-GCM Client-Side Before R2 Upload | Accepted | 2024-02-01 |
| [0004](./0004-advisory-lock-booking.md) | PostgreSQL Advisory Lock for Booking Slot Serialization | Accepted | 2024-03-10 |
| [0005](./0005-jwt-supabase-gotrue.md) | JWT Authentication via Supabase GoTrue | Accepted | 2024-01-15 |
