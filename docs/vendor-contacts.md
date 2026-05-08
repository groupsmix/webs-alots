# Vendor Contacts

> **Classification:** INTERNAL — Do not share externally  
> **Owner:** Engineering Lead | **Review:** Annual

This document contains technical support contacts for all critical third-party vendors.  
Emergency contacts are stored in 1Password under "Vendor Emergency Contacts".

---

## Cloudflare

- **Account type:** Business/Enterprise
- **Dashboard:** https://dash.cloudflare.com
- **Support portal:** https://support.cloudflare.com
- **Status page:** https://www.cloudflarestatus.com
- **Account ID:** Stored in 1Password → "Cloudflare Account"
- **Workers support:** Workers-specific tickets via Dashboard → Support
- **Emergency escalation:** Account manager contact in 1Password

---

## Supabase

- **Account type:** Pro / Team plan
- **Dashboard:** https://app.supabase.com
- **Support:** https://supabase.com/dashboard → Support
- **Status page:** https://status.supabase.com
- **Docs:** https://supabase.com/docs
- **GitHub issues:** https://github.com/supabase/supabase/issues

---

## OpenAI

- **Account:** API platform account
- **Dashboard:** https://platform.openai.com
- **Support:** https://help.openai.com
- **Status:** https://status.openai.com
- **API key:** Stored in Cloudflare Secrets as `OPENAI_API_KEY`
- **DPA:** https://openai.com/policies/data-processing-addendum

---

## Meta (WhatsApp Business API)

- **Platform:** Meta Business Suite
- **Dashboard:** https://business.facebook.com
- **WhatsApp Manager:** https://business.facebook.com/wa/manage/home/
- **Support:** https://business.facebook.com → Help Center → Contact Support
- **App ID / Secret:** Stored in Cloudflare Secrets as `META_APP_SECRET`, `META_WHATSAPP_TOKEN`
- **WABA ID:** Stored in clinic configuration (per-clinic `whatsapp_phone_number_id`)
- **Status:** https://metastatus.com
- **DPA:** https://www.facebook.com/legal/terms/dataprocessing

---

## Resend (Email Provider)

- **Dashboard:** https://resend.com/dashboard
- **Support:** support@resend.com
- **Status:** https://resend-status.com
- **API key:** Stored in Cloudflare Secrets as `RESEND_API_KEY`
- **DPA:** https://resend.com/legal/dpa

---

## Stripe

- **Dashboard:** https://dashboard.stripe.com
- **Support:** https://support.stripe.com
- **Status:** https://status.stripe.com
- **API keys:** Stored in Cloudflare Secrets as `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **DPA:** https://stripe.com/legal/dpa
- **PCI compliance:** Stripe is PCI-DSS Level 1 — no card data touches Oltigo servers

---

## CMI (Centre Monétique Interbancaire)

- **Type:** Moroccan interbank payment network
- **Portal:** https://cmi.co.ma
- **Technical support:** Stored in 1Password → "CMI Technical Contact"
- **Test gateway:** https://testpayment.cmi.co.ma
- **Production gateway:** https://payment.cmi.co.ma/fim/est3Dgate
- **Merchant ID:** Stored in Cloudflare Secrets as `CMI_MERCHANT_ID`
- **Secret key:** Stored in Cloudflare Secrets as `CMI_SECRET_KEY`
- **Integration docs:** Stored in `docs/cmi-integration-guide.pdf` (internal)

---

## Sentry (Error Monitoring)

- **Dashboard:** https://sentry.io
- **Support:** https://help.sentry.io
- **Status:** https://status.sentry.io
- **DSN:** Stored as `NEXT_PUBLIC_SENTRY_DSN` (non-secret, public)
- **Auth token:** Stored in Cloudflare Secrets as `SENTRY_AUTH_TOKEN`

---

## Emergency Escalation Path

For P0 incidents (data breach, service outage):

1. **Internal:** Page Engineering Lead via PagerDuty
2. **Cloudflare:** Enterprise support ticket + account manager
3. **Supabase:** Priority support ticket
4. **Legal/DPO:** dpo@oltigo.com — must be notified within 1h of potential data breach
5. **CNDP (Morocco):** https://www.cndp.ma — notify within 72h of confirmed breach (Law 09-08 Art.29)
