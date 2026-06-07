/**
 * Tests for the pure-function notification preference resolver
 * (`notification-preferences.ts`). These exercise `isChannelEnabled`,
 * `isTriggerEnabled`, and `canSendNotification` across every channel and
 * trigger to keep mutation coverage tight on the consent gating layer.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  canSendNotification,
  isChannelEnabled,
  isTriggerEnabled,
  type NotificationPreferenceSettings,
} from "../notification-preferences";
import type { NotificationChannel, NotificationTrigger } from "../notifications";

const allEnabled: NotificationPreferenceSettings = {
  whatsapp_enabled: true,
  email_enabled: true,
  in_app_enabled: true,
  appointment_reminders: true,
  booking_confirmations: true,
  payment_receipts: true,
  prescription_updates: true,
  marketing_updates: true,
};

const allDisabled: NotificationPreferenceSettings = {
  whatsapp_enabled: false,
  email_enabled: false,
  in_app_enabled: false,
  appointment_reminders: false,
  booking_confirmations: false,
  payment_receipts: false,
  prescription_updates: false,
  marketing_updates: false,
};

describe("DEFAULT_NOTIFICATION_PREFERENCES", () => {
  it("enables transactional channels and disables marketing by default", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.whatsapp_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.email_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.in_app_enabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.appointment_reminders).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.booking_confirmations).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.payment_receipts).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.prescription_updates).toBe(true);
    // Marketing is opt-in (Loi 09-08 / GDPR).
    expect(DEFAULT_NOTIFICATION_PREFERENCES.marketing_updates).toBe(false);
  });
});

describe("isChannelEnabled", () => {
  const cases: Array<[NotificationChannel, keyof NotificationPreferenceSettings]> = [
    ["whatsapp", "whatsapp_enabled"],
    ["email", "email_enabled"],
    ["in_app", "in_app_enabled"],
  ];

  for (const [channel, flag] of cases) {
    it(`returns the value of ${flag} for ${channel}`, () => {
      expect(isChannelEnabled({ ...allEnabled, [flag]: false }, channel)).toBe(false);
      expect(isChannelEnabled({ ...allDisabled, [flag]: true }, channel)).toBe(true);
    });
  }

  it("treats sms as governed by the whatsapp channel flag", () => {
    expect(isChannelEnabled(allEnabled, "sms")).toBe(true);
    expect(isChannelEnabled({ ...allEnabled, whatsapp_enabled: false }, "sms")).toBe(false);
  });

  it("returns true for unknown channels (fail-open)", () => {
    expect(isChannelEnabled(allDisabled, "unknown" as NotificationChannel)).toBe(true);
  });
});

describe("isTriggerEnabled", () => {
  const reminderTriggers: NotificationTrigger[] = [
    "reminder_24h",
    "reminder_1h",
    "reminder_2h",
    "follow_up",
  ];
  for (const t of reminderTriggers) {
    it(`gates ${t} on appointment_reminders`, () => {
      expect(isTriggerEnabled({ ...allEnabled, appointment_reminders: false }, t)).toBe(false);
      expect(isTriggerEnabled({ ...allDisabled, appointment_reminders: true }, t)).toBe(true);
    });
  }

  const bookingTriggers: NotificationTrigger[] = [
    "booking_confirmation",
    "new_booking",
    "cancellation",
    "no_show",
    "rescheduled",
    "doctor_assigned",
    "new_patient_registered",
  ];
  for (const t of bookingTriggers) {
    it(`gates ${t} on booking_confirmations`, () => {
      expect(isTriggerEnabled({ ...allEnabled, booking_confirmations: false }, t)).toBe(false);
      expect(isTriggerEnabled({ ...allDisabled, booking_confirmations: true }, t)).toBe(true);
    });
  }

  it("gates payment_received on payment_receipts", () => {
    expect(isTriggerEnabled({ ...allEnabled, payment_receipts: false }, "payment_received")).toBe(
      false,
    );
    expect(isTriggerEnabled({ ...allDisabled, payment_receipts: true }, "payment_received")).toBe(
      true,
    );
  });

  it("gates prescription_ready on prescription_updates", () => {
    expect(
      isTriggerEnabled({ ...allEnabled, prescription_updates: false }, "prescription_ready"),
    ).toBe(false);
    expect(
      isTriggerEnabled({ ...allDisabled, prescription_updates: true }, "prescription_ready"),
    ).toBe(true);
  });

  it("gates new_review on marketing_updates (opt-in)", () => {
    expect(isTriggerEnabled(allEnabled, "new_review")).toBe(true);
    expect(isTriggerEnabled({ ...allEnabled, marketing_updates: false }, "new_review")).toBe(false);
  });

  it("returns true for unknown triggers (fail-open)", () => {
    expect(
      isTriggerEnabled(allDisabled, "unknown_trigger" as unknown as NotificationTrigger),
    ).toBe(true);
  });
});

describe("canSendNotification", () => {
  it("requires BOTH channel and trigger to be enabled", () => {
    expect(canSendNotification(allEnabled, "whatsapp", "booking_confirmation")).toBe(true);

    expect(
      canSendNotification(
        { ...allEnabled, whatsapp_enabled: false },
        "whatsapp",
        "booking_confirmation",
      ),
    ).toBe(false);

    expect(
      canSendNotification(
        { ...allEnabled, booking_confirmations: false },
        "whatsapp",
        "booking_confirmation",
      ),
    ).toBe(false);
  });

  it("respects defaults: marketing trigger (new_review) is off, others on", () => {
    expect(
      canSendNotification(DEFAULT_NOTIFICATION_PREFERENCES, "whatsapp", "new_review"),
    ).toBe(false);
    expect(
      canSendNotification(DEFAULT_NOTIFICATION_PREFERENCES, "in_app", "booking_confirmation"),
    ).toBe(true);
  });

  it("blocks all delivery when every preference is off", () => {
    expect(canSendNotification(allDisabled, "whatsapp", "booking_confirmation")).toBe(false);
    expect(canSendNotification(allDisabled, "email", "reminder_24h")).toBe(false);
    expect(canSendNotification(allDisabled, "in_app", "payment_received")).toBe(false);
  });
});
