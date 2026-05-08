import { describe, it, expect } from "vitest";
import {
  substituteVariables,
  defaultNotificationTemplates,
  triggerMetadata,
  type TemplateVariables,
} from "../notifications";

describe("substituteVariables", () => {
  it("replaces a single variable", () => {
    const result = substituteVariables("Hello {{patient_name}}", {
      patient_name: "Karim",
    });
    expect(result).toBe("Hello Karim");
  });

  it("replaces multiple variables", () => {
    const result = substituteVariables(
      "{{patient_name}} has an appointment with {{doctor_name}} on {{date}} at {{time}}",
      {
        patient_name: "Karim",
        doctor_name: "Dr. Ahmed",
        date: "2026-03-20",
        time: "09:00",
      },
    );
    expect(result).toBe("Karim has an appointment with Dr. Ahmed on 2026-03-20 at 09:00");
  });

  it("leaves unmatched placeholders unchanged", () => {
    const result = substituteVariables("Hello {{patient_name}}, your {{unknown_var}}", {
      patient_name: "Karim",
    });
    expect(result).toBe("Hello Karim, your {{unknown_var}}");
  });

  it("handles empty variables object", () => {
    const result = substituteVariables("Hello {{patient_name}}", {});
    expect(result).toBe("Hello {{patient_name}}");
  });

  it("handles template with no placeholders", () => {
    const result = substituteVariables("No placeholders here", {
      patient_name: "Karim",
    });
    expect(result).toBe("No placeholders here");
  });

  it("handles empty template", () => {
    const result = substituteVariables("", { patient_name: "Karim" });
    expect(result).toBe("");
  });

  it("replaces the same variable multiple times", () => {
    const result = substituteVariables("{{name}} and {{name}} again", {
      name: "Karim",
    } as TemplateVariables);
    expect(result).toBe("Karim and Karim again");
  });
});

describe("defaultNotificationTemplates", () => {
  it("has at least 10 templates", () => {
    expect(defaultNotificationTemplates.length).toBeGreaterThanOrEqual(10);
  });

  it("each template has required fields", () => {
    for (const template of defaultNotificationTemplates) {
      expect(template.id).toBeTruthy();
      expect(template.trigger).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.label).toBeTruthy();
      expect(template.channels).toBeInstanceOf(Array);
      expect(template.channels.length).toBeGreaterThan(0);
      expect(template.subject).toBeTruthy();
      expect(template.body).toBeTruthy();
      expect(template.whatsappBody).toBeTruthy();
      expect(typeof template.enabled).toBe("boolean");
      expect(template.priority).toBeTruthy();
      expect(template.recipientRoles).toBeInstanceOf(Array);
      expect(template.recipientRoles.length).toBeGreaterThan(0);
    }
  });

  it("all templates have unique IDs", () => {
    const ids = defaultNotificationTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes booking_confirmation template", () => {
    const found = defaultNotificationTemplates.find((t) => t.trigger === "booking_confirmation");
    expect(found).toBeDefined();
    expect(found!.channels).toContain("whatsapp");
    expect(found!.recipientRoles).toContain("patient");
  });

  it("includes payment_received template", () => {
    const found = defaultNotificationTemplates.find((t) => t.trigger === "payment_received");
    expect(found).toBeDefined();
    expect(found!.body).toContain("{{amount}}");
  });
});

describe("triggerMetadata", () => {
  it("has metadata for all notification triggers", () => {
    const expectedTriggers = [
      "new_booking", "booking_confirmation", "reminder_24h", "reminder_1h",
      "reminder_2h", "cancellation", "no_show", "prescription_ready",
      "new_review", "payment_received", "new_patient_registered",
      "rescheduled", "doctor_assigned", "follow_up",
    ];
    for (const trigger of expectedTriggers) {
      expect(triggerMetadata[trigger as keyof typeof triggerMetadata]).toBeDefined();
      expect(triggerMetadata[trigger as keyof typeof triggerMetadata].label).toBeTruthy();
      expect(triggerMetadata[trigger as keyof typeof triggerMetadata].description).toBeTruthy();
      expect(triggerMetadata[trigger as keyof typeof triggerMetadata].icon).toBeTruthy();
    }
  });
});
