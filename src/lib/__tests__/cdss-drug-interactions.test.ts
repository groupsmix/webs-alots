import { describe, it, expect } from "vitest";
import { checkInteractions, INTERACTION_PAIRS, CROSS_REACTIVITY } from "../cdss/drug-interactions";

describe("checkInteractions", () => {
  it("returns empty array for empty drug name", () => {
    expect(checkInteractions("", ["warfarine"], [])).toEqual([]);
  });

  it("detects critical warfarine + aspirin interaction", () => {
    const alerts = checkInteractions("warfarine", ["acide acétylsalicylique"], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].pair).toEqual(["warfarine", "acide acétylsalicylique"]);
  });

  it("detects bidirectional interaction (drug B checked against drug A)", () => {
    const alerts = checkInteractions("ibuprofène", ["warfarine"], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
  });

  it("detects major interaction (clopidogrel + oméprazole)", () => {
    const alerts = checkInteractions("clopidogrel", ["oméprazole"], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("major");
  });

  it("detects minor interaction (warfarine + amoxicilline)", () => {
    const alerts = checkInteractions("warfarine", ["amoxicilline"], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("minor");
  });

  it("detects allergy cross-reactivity (amoxicilline + pénicilline allergy)", () => {
    const alerts = checkInteractions("amoxicilline", [], ["pénicilline"]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].message).toContain("Réactivité croisée");
  });

  it("detects same-drug allergy", () => {
    const alerts = checkInteractions("amoxicilline", [], ["amoxicilline"]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
  });

  it("returns no alerts for non-interacting drugs", () => {
    const alerts = checkInteractions("paracétamol", ["oméprazole"], []);
    expect(alerts).toHaveLength(0);
  });

  it("sorts alerts by severity (critical first)", () => {
    const alerts = checkInteractions("warfarine", ["acide acétylsalicylique", "amoxicilline"], []);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[alerts.length - 1].severity).toBe("minor");
  });

  it("combines drug-drug and allergy alerts", () => {
    const alerts = checkInteractions("amoxicilline", ["warfarine"], ["pénicilline"]);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    const severities = alerts.map((a) => a.severity);
    expect(severities).toContain("critical");
    expect(severities).toContain("minor");
  });
});

describe("INTERACTION_PAIRS", () => {
  it("has at least 10 interaction pairs", () => {
    expect(INTERACTION_PAIRS.length).toBeGreaterThanOrEqual(10);
  });

  it("all pairs have required fields", () => {
    for (const pair of INTERACTION_PAIRS) {
      expect(pair.drugA).toBeTruthy();
      expect(pair.drugB).toBeTruthy();
      expect(["critical", "major", "minor"]).toContain(pair.severity);
      expect(pair.clinicalEffect).toBeTruthy();
      expect(pair.recommendation).toBeTruthy();
    }
  });
});

describe("CROSS_REACTIVITY", () => {
  it("has pénicilline cross-reactivity entries", () => {
    expect(CROSS_REACTIVITY["pénicilline"]).toBeDefined();
    expect(CROSS_REACTIVITY["pénicilline"].length).toBeGreaterThan(0);
  });

  it("has bidirectional entries for amoxicilline", () => {
    expect(CROSS_REACTIVITY["amoxicilline"]).toBeDefined();
    expect(CROSS_REACTIVITY["amoxicilline"]).toContain("pénicilline");
  });
});
