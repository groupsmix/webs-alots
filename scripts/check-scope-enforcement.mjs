#!/usr/bin/env node
/**
 * CI guard: ADR 0013 — Operations-First Scope Enforcement.
 *
 * Verifies that Architecture-B surfaces are explicitly modeled and gated:
 *   1. Gated API route groups either do not exist or contain route-level scope checks.
 *   2. Gated dashboard/page groups are declared in `verticals.ts`.
 *   3. Shared layouts mount centralized gates so individual pages cannot bypass scope.
 *
 * The script intentionally uses static/textual checks and no TypeScript imports so it
 * can run in minimal CI environments before the full app is built.
 *
 * @see docs/archive/adr/0013-operations-first-scope.md
 * @see src/lib/config/verticals.ts — VERTICAL_SCOPES / ALL_GATED_* constants
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const API_DIR = join(ROOT, "src", "app", "api");
const VERTICALS_FILE = join(ROOT, "src", "lib", "config", "verticals.ts");
const ROUTE_SCOPE_GATE_FILE = join(ROOT, "src", "components", "route-scope-gate.tsx");
const ADMIN_LAYOUT_FILE = join(ROOT, "src", "app", "(admin)", "layout.tsx");
const DOCTOR_LAYOUT_FILE = join(ROOT, "src", "app", "(doctor)", "layout.tsx");
const CLINIC_DASHBOARD_LAYOUT_FILE = join(
  ROOT,
  "src",
  "components",
  "layouts",
  "clinic-dashboard-layout.tsx",
);
const SPECIALIST_LAYOUT_FILE = join(
  ROOT,
  "src",
  "components",
  "layouts",
  "specialist-layout-shell.tsx",
);
const EQUIPMENT_LAYOUT_FILE = join(
  ROOT,
  "src",
  "components",
  "layouts",
  "equipment-layout-shell.tsx",
);

// These API groups are gated per ADR 0013. Must match VERTICAL_SCOPES in
// src/lib/config/verticals.ts. Kept as a static list so this script has
// zero runtime dependencies.
const GATED_API_GROUPS = [
  "prescriptions",
  "vitals",
  "radiology",
  "insurance-claims",
  "admissions",
  "pets",
  "menus",
  "restaurant-orders",
  "restaurant-tables",
];

// Representative dashboard/page groups that must stay modeled in the scope matrix.
// This is a drift sentinel, not an exhaustive parser for every union member.
const REQUIRED_GATED_DASHBOARDS = [
  "admin/departments",
  "admin/beds",
  "admin/machines",
  "admin/lab-materials",
  "admin/lab-invoices",
  "doctor/cardiology",
  "doctor/dialysis-sessions",
  "doctor/ivf-cycles",
  "doctor/odontogram",
  "doctor/vaccinations",
  "equipment",
  "nutritionist",
  "optician",
  "parapharmacy",
  "pharmacist",
  "physiotherapist",
  "psychologist",
  "radiology-dashboard",
  "speech-therapist",
  "restaurant",
  "veterinary",
];

const GATE_PATTERNS = [
  /assertScopeGate/,
  /isGatedApiGroupEnabled/,
  /isFeatureEnabled\s*\(/,
  /isApiGroupEnabled/,
  /withAuth\s*\(/,
  /withAuthAnyRole\s*\(/,
  /@scope-gate-exempt/,
  /SCOPE_GATE_EXEMPT/,
];

let failures = 0;
let checkedRoutes = 0;

function fail(message, detail) {
  console.error(`FAIL: ${message}`);
  if (detail) console.error(`      ${detail}`);
  failures++;
}

function readRequired(file) {
  if (!existsSync(file)) {
    fail(`${relative(ROOT, file)} is missing.`);
    return "";
  }
  return readFileSync(file, "utf-8");
}

function findRouteFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      results.push(fullPath);
    }
  }
  return results;
}

function includesQuotedString(content, value) {
  return content.includes(`"${value}"`) || content.includes(`'${value}'`);
}

function checkApiRoutes() {
  for (const group of GATED_API_GROUPS) {
    const groupDir = join(API_DIR, group);
    if (!existsSync(groupDir) || !statSync(groupDir).isDirectory()) continue;

    const routeFiles = findRouteFiles(groupDir);
    for (const routeFile of routeFiles) {
      checkedRoutes++;
      const content = readFileSync(routeFile, "utf-8");
      const hasGate = GATE_PATTERNS.some((pattern) => pattern.test(content));

      if (!hasGate) {
        const relPath = relative(ROOT, routeFile);
        fail(
          `${relPath} — gated API group "${group}" route has no scope-enforcement check.`,
          `Add isGatedApiGroupEnabled("${group}", featuresConfig) or mark @scope-gate-exempt.`,
        );
      }
    }
  }
}

function checkScopeMatrix() {
  const verticals = readRequired(VERTICALS_FILE);
  if (!verticals) return;

  for (const group of GATED_API_GROUPS) {
    if (!includesQuotedString(verticals, group)) {
      fail(
        `src/lib/config/verticals.ts is missing gated API group "${group}".`,
        "Architecture-B API groups must stay modeled even when their route directories are deleted.",
      );
    }
  }

  for (const dashboard of REQUIRED_GATED_DASHBOARDS) {
    if (!includesQuotedString(verticals, dashboard)) {
      fail(
        `src/lib/config/verticals.ts is missing gated dashboard "${dashboard}".`,
        "Surviving Architecture-B dashboards must stay listed in DASHBOARD_FEATURE_REQUIREMENTS/VERTICAL_SCOPES.",
      );
    }
  }

  for (const exportName of [
    "ALL_GATED_API_GROUPS",
    "ALL_GATED_DASHBOARDS",
    "getScopedDashboardForPathname",
    "isDashboardEnabled",
  ]) {
    if (!verticals.includes(exportName)) {
      fail(`src/lib/config/verticals.ts is missing ${exportName}.`);
    }
  }
}

function checkDashboardLayoutGates() {
  const routeGate = readRequired(ROUTE_SCOPE_GATE_FILE);
  const adminLayout = readRequired(ADMIN_LAYOUT_FILE);
  const doctorLayout = readRequired(DOCTOR_LAYOUT_FILE);
  const clinicDashboardLayout = readRequired(CLINIC_DASHBOARD_LAYOUT_FILE);
  const specialistLayout = readRequired(SPECIALIST_LAYOUT_FILE);
  const equipmentLayout = readRequired(EQUIPMENT_LAYOUT_FILE);

  if (routeGate) {
    for (const token of [
      "getScopedDashboardForPathname",
      "getDashboardRequiredFlags",
      "useClinicFeatures",
    ]) {
      if (!routeGate.includes(token)) {
        fail(`src/components/route-scope-gate.tsx does not use ${token}.`);
      }
    }
  }

  if (adminLayout && !adminLayout.includes("RouteScopeGate")) {
    fail(
      "src/app/(admin)/layout.tsx does not mount RouteScopeGate.",
      "Admin Architecture-B pages must be gated at the shared layout boundary.",
    );
  }

  if (doctorLayout && !doctorLayout.includes("RouteScopeGate")) {
    fail(
      "src/app/(doctor)/layout.tsx does not mount RouteScopeGate.",
      "Doctor specialty pages must be gated at the shared layout boundary.",
    );
  }

  if (clinicDashboardLayout) {
    for (const token of [
      "useClinicFeatures",
      "visibleNavItems",
      "visibleMobileTabs",
      "FeatureGate",
    ]) {
      if (!clinicDashboardLayout.includes(token)) {
        fail(
          `src/components/layouts/clinic-dashboard-layout.tsx is missing ${token}.`,
          "Specialist dashboards must filter navigation and gate module content centrally.",
        );
      }
    }
  }

  if (specialistLayout && !specialistLayout.includes("ClinicDashboardLayout")) {
    fail(
      "src/components/layouts/specialist-layout-shell.tsx no longer delegates to ClinicDashboardLayout.",
      "Specialist surfaces must keep the shared feature-gated dashboard shell.",
    );
  }

  if (equipmentLayout) {
    for (const token of ["useClinicFeatures", "requiredFeaturesForPathname", "visibleNavItems"]) {
      if (!equipmentLayout.includes(token)) {
        fail(
          `src/components/layouts/equipment-layout-shell.tsx is missing ${token}.`,
          "Equipment has a custom shell and must enforce its own feature split.",
        );
      }
    }
  }
}

checkScopeMatrix();
checkApiRoutes();
checkDashboardLayoutGates();

console.log(
  `\nScope enforcement check: ${checkedRoutes} gated API route file(s) scanned, ${failures} failure(s).`,
);

if (failures > 0) {
  console.error(
    "\nFix: restore ADR-0013 scope modeling/gates or add explicit @scope-gate-exempt notes.",
  );
  console.error("See: docs/archive/adr/0013-operations-first-scope.md\n");
  process.exit(1);
}

console.log("All scoped API/dashboard surfaces have architecture enforcement. OK.\n");
