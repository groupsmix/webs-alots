# ECCN Self-Classification — Export Controls (A198)

**Last reviewed:** 2026-05-28
**Classification:** EAR99 (likely qualifies for 5D002 / License Exception ENC §740.17(b))
**Reviewer:** Engineering / DPO

---

## Overview

Oltigo Health is a cloud-hosted SaaS healthcare platform serving clinics in Morocco.
This document records the export-control self-classification required by the
U.S. Export Administration Regulations (EAR) and the Wassenaar Arrangement.

## Encryption Use

| Component       | Algorithm            | Purpose                                               |
| --------------- | -------------------- | ----------------------------------------------------- |
| TLS 1.2/1.3     | Standard browser TLS | All client–server communication                       |
| AES-256-GCM     | Web Crypto API       | PHI file encryption at rest (Cloudflare R2)           |
| HMAC-SHA256     | Node.js `crypto`     | Booking token signatures, profile header verification |
| bcrypt / Argon2 | Supabase Auth        | Password hashing                                      |

## Classification Rationale

1. **EAR99 / 5D002:** The application uses only standard, publicly available
   encryption (TLS, AES-256-GCM, HMAC-SHA256) via browser Web Crypto API and
   Node.js built-in `crypto` module. No custom cryptographic algorithms are
   implemented.

2. **License Exception ENC §740.17(b) (mass-market):** The encryption
   functionality is integral to the application and is not user-configurable.
   The product is available for download/access by any user (SaaS), making it
   eligible for the mass-market exception under §740.17(b)(1).

3. **No controlled destinations:** The application currently serves only
   Moroccan clinics. Morocco is not subject to comprehensive U.S. sanctions
   (OFAC SDN list checked; Morocco is in Country Group B).

## Sanctioned-Country Access

The platform does not currently implement geographic access restrictions
(IP-based blocking). Given the Morocco-only target market, exposure is low.
Should the platform expand internationally:

- Implement Cloudflare WAF rules to block requests from OFAC-sanctioned
  countries (Cuba, Iran, North Korea, Syria, Crimea/Donetsk/Luhansk regions).
- Review EAR Classification annually or when adding new encryption features.

## BIS Notification

For mass-market encryption software under §740.17(b), a self-classification
report (CCATS) to BIS is not required but is recommended for de-risking.
File via https://bis.gov/encryption if expanding to U.S. or EU markets.

## Annual Review

This classification should be reviewed:

- Annually (next: 2027-05-28)
- When adding new cryptographic features
- When expanding to new geographic markets
- When OFAC sanctions lists are updated
