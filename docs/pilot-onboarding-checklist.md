# Pilot Clinic Onboarding Checklist

This runbook outlines the required steps to onboard a new pilot clinic into the Oltigo Health platform for Phase 13.

## Phase 13 Target Profiles
We are targeting three specific profiles for this pilot:
1. **General Practitioner / Single Doctor Clinic**
2. **Dental Clinic**
3. **Specialist Office or Pharmacy**

---

## Onboarding Steps

### 1. Account & Infrastructure Setup
- [ ] Create the clinic record in the database (or via KYC approval).
- [ ] Set `tier` to `professional` (or appropriate pilot tier) to enable WhatsApp and AI features.
- [ ] Configure `subdomain` and verify routing.
- [ ] Ensure the clinic's WhatsApp Business Account (WABA) is linked and verified.

### 2. Clinic Profile & Configuration
- [ ] Upload clinic logo and set brand colors.
- [ ] Configure standard working hours.
- [ ] Define the primary services offered, including durations and prices.
- [ ] Create the first Doctor profile.
- [ ] Create the Receptionist profile.

### 3. WhatsApp Integration
- [ ] Submit the 10 Darija standard templates to Meta for approval.
- [ ] Verify template approval in the `/admin/notifications` dashboard.
- [ ] Send a test booking to verify the `CONFIRMATION` and `REMINDER` triggers.

### 4. Training & Handover
- [ ] Conduct a 30-minute training call with the Receptionist and Doctor.
- [ ] Provide the booking URL to the clinic for their Google My Business and social media.
- [ ] Schedule the first feedback check-in (Day 3, Day 7, Day 14).

### 5. Monitoring
- [ ] Monitor the Super-Admin Pilots Dashboard (`/super-admin/pilots`) for active bookings.
- [ ] Check the `webhook_retry_queue` and `notification_queue` daily for any failures specific to this clinic.
- [ ] Review any AI token usage to ensure budget limits are respected.
