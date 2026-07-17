import { describe, it, expect } from "vitest";
import {
  computeRecallDueDate,
  getRecallMessageTemplate,
  matchRecallRule,
} from "@/lib/config/recall-rules";

describe("recall rules — service matching", () => {
  it("maps détartrage/cleaning to a 6-month hygiene recall", () => {
    for (const name of ["Détartrage", "detartrage", "Dental cleaning", "Nettoyage dentaire"]) {
      const rule = matchRecallRule(name);
      expect(rule).not.toBeNull();
      expect(rule!.recallType).toBe("detartrage");
      expect(rule!.intervalDays).toBe(180);
    }
  });

  it("maps orthodontic services to a monthly follow-up", () => {
    for (const name of ["Consultation orthodontie", "Pose de bagues", "Ortho"]) {
      const rule = matchRecallRule(name);
      expect(rule).not.toBeNull();
      expect(rule!.recallType).toBe("orthodontic");
      expect(rule!.intervalDays).toBe(30);
    }
  });

  it("maps implant services to a 6-month control", () => {
    const rule = matchRecallRule("Pose d'implant");
    expect(rule).not.toBeNull();
    expect(rule!.recallType).toBe("implant");
    expect(rule!.intervalDays).toBe(180);
  });

  it("prioritizes implant over détartrage when both appear", () => {
    const rule = matchRecallRule("Implant + détartrage");
    expect(rule!.recallType).toBe("implant");
  });

  it("returns null for one-off acts and empty input", () => {
    expect(matchRecallRule("Extraction dentaire")).toBeNull();
    expect(matchRecallRule("Consultation dentaire")).toBeNull();
    expect(matchRecallRule("")).toBeNull();
    expect(matchRecallRule(null)).toBeNull();
    expect(matchRecallRule(undefined)).toBeNull();
  });
});

describe("recall rules — due date computation", () => {
  it("adds the interval in days to the completed date", () => {
    expect(computeRecallDueDate("2026-01-01", 180)).toBe("2026-06-30");
    expect(computeRecallDueDate("2026-01-01", 30)).toBe("2026-01-31");
  });

  it("accepts Date objects", () => {
    expect(computeRecallDueDate(new Date("2026-01-01T10:00:00Z"), 30)).toBe("2026-01-31");
  });

  it("returns null for unparseable dates", () => {
    expect(computeRecallDueDate("not-a-date", 180)).toBeNull();
  });
});

describe("recall rules — localized messages", () => {
  it("provides a template for every recall type and locale", () => {
    for (const type of ["detartrage", "orthodontic", "implant"] as const) {
      for (const locale of ["fr", "ar", "ary", "en"]) {
        const tpl = getRecallMessageTemplate(type, locale);
        expect(tpl).toContain("{{patient_name}}");
        expect(tpl).toContain("{{clinic_name}}");
      }
    }
  });

  it("falls back to French for unknown locales", () => {
    expect(getRecallMessageTemplate("detartrage", "de")).toBe(
      getRecallMessageTemplate("detartrage", "fr"),
    );
  });
});
