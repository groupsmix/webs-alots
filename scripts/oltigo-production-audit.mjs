#!/usr/bin/env node
/*
 * Oltigo Production E2E Audit
 *
 * Runs an authenticated end-to-end audit of the deployed Oltigo app on
 * oltigo.com. It logs in with the supplied admin credentials, visits the
 * public site, admin dashboard, and super-admin pages, and records every
 * HTTP status, console error, JS exception, and network failure.
 *
 * Usage:
 *   export PATH=/home/ubuntu/.n/bin:$PATH
 *   E2E_BASE_URL=https://oltigo.com \
 *   ADMIN_EMAIL=admin@admin.com \
 *   ADMIN_PASSWORD=123456789 \
 *   node scripts/oltigo-production-audit.mjs
 */

import { promises as fs, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.E2E_BASE_URL || "https://oltigo.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@admin.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456789";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/home/ubuntu/oltigo-audit-output";
const DELAY_MS = Number(process.env.AUDIT_DELAY_MS || 1500);

const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

/** Accumulated findings. */
const findings = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  adminEmail: ADMIN_EMAIL,
  role: null,
  login: null,
  public: [],
  admin: [],
  superAdmin: [],
  issues: [],
};

function addIssue(entry, issue) {
  const i = { page: entry.route, ...issue, at: new Date().toISOString() };
  findings.issues.push(i);
  entry.issues.push(i);
}

function sanitizeFilename(route) {
  return route.replace(/^\//, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "home";
}

function makeRouteFromDir(base, dir) {
  const relative = path.relative(base, dir);
  let route = "/" + relative.replace(/\\/g, "/");
  if (route.endsWith("/page")) route = route.slice(0, -5);
  if (route.endsWith("/")) route = route.slice(0, -1);
  if (!route) route = "/";
  return route;
}

async function discoverPages(baseRoute, sourceDir) {
  const routes = [];
  async function walk(dir, root) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // skip route groups, dynamic params with no resolver, and layouts
        if (e.name.startsWith("(")) continue;
        if (e.name.startsWith("[") && e.name.includes("[[")) continue;
        const hasPage = (await fs.readdir(full)).some((n) => n === "page.tsx" || n === "page.ts");
        if (hasPage) {
          const route = makeRouteFromDir(root, full);
          if (!route.includes("[")) routes.push(route);
        }
        await walk(full, root);
      }
    }
  }
  await walk(sourceDir, sourceDir);
  // Remove duplicates and sort
  const unique = [...new Set(routes)].sort();
  // prepend the base route if missing
  return unique.map((r) => (baseRoute === "/" ? r : baseRoute + r));
}

async function auditPage(page, context, route, options = {}) {
  const entry = {
    route,
    requested: route,
    finalUrl: null,
    httpStatus: null,
    title: null,
    bodyText: null,
    bodyLength: 0,
    screenshot: null,
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
    issues: [],
    loadTimeMs: null,
  };

  const consoleErrors = [];
  const pageErrors = [];
  const networkErrors = [];

  const onConsole = (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      consoleErrors.push({ type, text: msg.text() });
    }
  };
  const onPageError = (err) => pageErrors.push(err.message);
  const onResponse = (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && url.startsWith(BASE_URL)) {
      networkErrors.push({ status, url });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  const start = Date.now();
  try {
    const response = await page.goto(route, {
      waitUntil: "load",
      timeout: 20000,
    });
    entry.httpStatus = response?.status() ?? null;
    // Wait for the DOM body to be attached/visible as an explicit readiness check
    // instead of relying on the much slower "networkidle" lifecycle.
    await page.locator("body").waitFor({ state: "visible", timeout: 5000 });
  } catch (e) {
    entry.httpStatus = `goto-error: ${e.message}`;
    addIssue(entry, {
      severity: "critical",
      category: "navigation",
      title: "Page navigation failed",
      detail: e.message,
    });
  }
  const loadTime = Date.now() - start;
  entry.loadTimeMs = loadTime;

  entry.finalUrl = page.url();
  try {
    entry.title = await page.title();
  } catch {
    entry.title = null;
  }
  try {
    entry.bodyText = await page.locator("body").innerText({ timeout: 3000 });
    entry.bodyLength = entry.bodyText.length;
  } catch {
    entry.bodyText = null;
    entry.bodyLength = 0;
  }

  // take screenshot for any page with an error or just a sample
  try {
    const slug = sanitizeFilename(entry.finalUrl.replace(BASE_URL, "") || route);
    const shotPath = path.join(SCREENSHOT_DIR, `${slug}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    entry.screenshot = shotPath;
  } catch {
    // screenshots are best effort
  }

  entry.consoleErrors = consoleErrors;
  entry.pageErrors = pageErrors;
  entry.networkErrors = networkErrors;

  // classify issues
  if (typeof entry.httpStatus === "number") {
    if (entry.httpStatus >= 500) {
      addIssue(entry, {
        severity: "critical",
        category: "http",
        title: `Server error ${entry.httpStatus}`,
        detail: `Page returned ${entry.httpStatus}`,
      });
    } else if (entry.httpStatus === 404) {
      addIssue(entry, {
        severity: "medium",
        category: "http",
        title: "Page not found",
        detail: "Route returned 404",
      });
    } else if (entry.httpStatus === 403) {
      if (options.allow403) {
        // expected for unauthenticated-only probes
      } else {
        addIssue(entry, {
          severity: "high",
          category: "http",
          title: "Forbidden",
          detail: "Authenticated admin received 403",
        });
      }
    } else if (entry.httpStatus === 429) {
      addIssue(entry, {
        severity: "medium",
        category: "http",
        title: "Rate limited (429)",
        detail: "Too many requests",
      });
    } else if (entry.httpStatus >= 400) {
      addIssue(entry, {
        severity: "high",
        category: "http",
        title: `HTTP error ${entry.httpStatus}`,
        detail: `Page returned ${entry.httpStatus}`,
      });
    }
  }

  if (entry.bodyLength === 0) {
    addIssue(entry, {
      severity: "high",
      category: "render",
      title: "Blank or empty body",
      detail: "Body had no visible text",
    });
  }

  for (const err of pageErrors) {
    addIssue(entry, {
      severity: "high",
      category: "javascript",
      title: "JS exception",
      detail: err,
    });
  }

  for (const msg of consoleErrors) {
    // Console warnings are not always bugs; capture as low severity
    const severity = msg.type === "error" ? "high" : "low";
    addIssue(entry, {
      severity,
      category: "console",
      title: `Console ${msg.type}`,
      detail: msg.text,
    });
  }

  for (const net of networkErrors) {
    // Skip known/expected endpoints (e.g., 401 for some API probes is expected in admin context)
    if (options.skipNetworkStatuses?.includes(net.status)) continue;
    addIssue(entry, {
      severity: "high",
      category: "network",
      title: `Network failure ${net.status}`,
      detail: net.url,
    });
  }

  // Wait a beat to respect rate limits
  if (DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  return entry;
}

async function performLogin(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const loginEntry = {
    route: "/login",
    finalUrl: null,
    httpStatus: null,
    title: null,
    role: null,
    error: null,
    issues: [],
  };

  try {
    await page.goto("/login", { waitUntil: "load", timeout: 15000 });
    // Explicit readiness assertions instead of waiting for all network to idle.
    await page.locator('input[name="email"]').waitFor({ state: "visible", timeout: 10000 });
    await page.locator('input[name="password"]').waitFor({ state: "visible", timeout: 10000 });
    await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);

    const submit = page.locator('button[type="submit"]');
    await submit.waitFor({ state: "visible", timeout: 5000 });
    await submit.click();

    await page.waitForURL(/\/(admin|super-admin|doctor|receptionist|patient)\/dashboard/, {
      timeout: 20000,
    });

    loginEntry.finalUrl = page.url();
    loginEntry.httpStatus = 200;

    if (loginEntry.finalUrl.includes("/super-admin")) loginEntry.role = "super_admin";
    else if (loginEntry.finalUrl.includes("/admin")) loginEntry.role = "clinic_admin";
    else if (loginEntry.finalUrl.includes("/doctor")) loginEntry.role = "doctor";
    else if (loginEntry.finalUrl.includes("/receptionist")) loginEntry.role = "receptionist";
    else if (loginEntry.finalUrl.includes("/patient")) loginEntry.role = "patient";
    else loginEntry.role = "unknown";

    findings.role = loginEntry.role;
  } catch (e) {
    loginEntry.error = e.message;
    loginEntry.finalUrl = page.url();
    try {
      loginEntry.title = await page.title();
    } catch {}
    // Capture error message on the page, if any
    const alertText = await page
      .locator('[role="alert"], .text-destructive, .text-red-500')
      .first()
      .innerText({ timeout: 2000 })
      .catch(() => null);
    if (alertText) loginEntry.pageError = alertText;

    // screenshot login attempt
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "login-failed.png"),
        fullPage: true,
      });
    } catch {}
  }

  await page.close();
  return loginEntry;
}

async function main() {
  console.log(`Starting Oltigo production audit against ${BASE_URL}`);
  console.log(`Admin user: ${ADMIN_EMAIL}`);

  const browser = await chromium.launch({ headless: true });
  const adminContext = await browser.newContext({ baseURL: BASE_URL });

  const loginEntry = await performLogin(adminContext);
  findings.login = loginEntry;

  if (!loginEntry.role) {
    findings.admin.push({ route: "(login failed)", error: loginEntry.error });
    findings.issues.push({
      severity: "critical",
      category: "auth",
      title: "Admin login failed",
      detail: loginEntry.error || loginEntry.pageError || "Could not log in",
      page: "/login",
      at: new Date().toISOString(),
    });
  }

  // Public pages (use a fresh unauthenticated context)
  const publicContext = await browser.newContext({ baseURL: BASE_URL });
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/pricing",
    "/about",
    "/services",
    "/book",
    "/contact",
  ];
  const publicApiRoutes = ["/api/health", "/api/branding"];

  for (const route of publicRoutes) {
    const page = await publicContext.newPage();
    const entry = await auditPage(page, publicContext, route, {
      allow403: true,
      skipNetworkStatuses: [401, 403],
    });
    findings.public.push(entry);
    await page.close();
  }

  const publicApiContext = await browser.newContext({ baseURL: BASE_URL });
  for (const route of publicApiRoutes) {
    const page = await publicApiContext.newPage();
    const entry = await auditPage(page, publicApiContext, route, { allow403: true });
    entry.api = true;
    findings.public.push(entry);
    await page.close();
  }

  // Admin pages
  if (loginEntry.role) {
    const adminSource = path.join(__dirname, "..", "src", "app", "(admin)", "admin");
    let adminRoutes = [];
    try {
      adminRoutes = await discoverPages("/admin", adminSource);
    } catch (e) {
      console.warn("Could not discover admin pages", e.message);
      adminRoutes = [
        "/admin/dashboard",
        "/admin/patients",
        "/admin/doctors",
        "/admin/receptionists",
        "/admin/services",
        "/admin/appointments",
        "/admin/settings",
        "/admin/billing",
      ];
    }

    for (const route of adminRoutes) {
      const page = await adminContext.newPage();
      const entry = await auditPage(page, adminContext, route);
      findings.admin.push(entry);
      await page.close();
    }

    // If admin is a super_admin, also test super-admin pages
    if (loginEntry.role === "super_admin") {
      const superAdminSource = path.join(
        __dirname,
        "..",
        "src",
        "app",
        "(super-admin)",
        "super-admin",
      );
      let superAdminRoutes = [];
      try {
        superAdminRoutes = await discoverPages("/super-admin", superAdminSource);
      } catch (e) {
        console.warn("Could not discover super-admin pages", e.message);
        superAdminRoutes = [
          "/super-admin/dashboard",
          "/super-admin/clinics",
          "/super-admin/subscriptions",
          "/super-admin/team",
          "/super-admin/analytics",
        ];
      }

      for (const route of superAdminRoutes) {
        const page = await adminContext.newPage();
        const entry = await auditPage(page, adminContext, route);
        findings.superAdmin.push(entry);
        await page.close();
      }
    }
  }

  await browser.close();

  // Write findings as JSON and markdown
  findings.finishedAt = new Date().toISOString();
  findings.summary = {
    totalPages: findings.public.length + findings.admin.length + findings.superAdmin.length,
    totalIssues: findings.issues.length,
    critical: findings.issues.filter((i) => i.severity === "critical").length,
    high: findings.issues.filter((i) => i.severity === "high").length,
    medium: findings.issues.filter((i) => i.severity === "medium").length,
    low: findings.issues.filter((i) => i.severity === "low").length,
  };

  const jsonPath = path.join(OUTPUT_DIR, "audit-results.json");
  await fs.writeFile(jsonPath, JSON.stringify(findings, null, 2));

  const md = buildReportMarkdown(findings);
  const mdPath = path.join(OUTPUT_DIR, "audit-report.md");
  await fs.writeFile(mdPath, md);

  console.log("\nAudit complete.");
  console.log(`Pages checked: ${findings.summary.totalPages}`);
  console.log(`Total issues: ${findings.summary.totalIssues}`);
  console.log(`Report: ${mdPath}`);
  console.log(`Raw JSON: ${jsonPath}`);

  if (findings.summary.totalIssues > 0) {
    console.log("\nIssue summary by severity:");
    console.log(`  critical: ${findings.summary.critical}`);
    console.log(`  high: ${findings.summary.high}`);
    console.log(`  medium: ${findings.summary.medium}`);
    console.log(`  low: ${findings.summary.low}`);
  }
}

function buildReportMarkdown(data) {
  const lines = [];
  lines.push(`# Oltigo Production E2E Audit Report`);
  lines.push("");
  lines.push(`- **Base URL:** ${data.baseUrl}`);
  lines.push(`- **Admin email:** ${data.adminEmail}`);
  lines.push(`- **Role detected:** ${data.role || "(login failed)"}`);
  lines.push(`- **Started:** ${data.startedAt}`);
  lines.push(`- **Finished:** ${data.finishedAt}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Total pages checked | ${data.summary.totalPages} |`);
  lines.push(`| Total issues | ${data.summary.totalIssues} |`);
  lines.push(`| Critical | ${data.summary.critical} |`);
  lines.push(`| High | ${data.summary.high} |`);
  lines.push(`| Medium | ${data.summary.medium} |`);
  lines.push(`| Low | ${data.summary.low} |`);
  lines.push("");

  lines.push(`## Login`);
  lines.push("");
  if (data.login.role) {
    lines.push(`- **Status:** success`);
    lines.push(`- **Final URL:** ${data.login.finalUrl}`);
    lines.push(`- **Role:** ${data.login.role}`);
  } else {
    lines.push(`- **Status:** failed`);
    lines.push(`- **Error:** ${data.login.error || data.login.pageError || "unknown"}`);
    lines.push(`- **Final URL:** ${data.login.finalUrl || "N/A"}`);
  }
  lines.push("");

  for (const section of ["public", "admin", "superAdmin"]) {
    const entries = data[section];
    if (!entries.length) continue;
    lines.push(
      `## ${section === "superAdmin" ? "Super Admin" : section[0].toUpperCase() + section.slice(1)} Pages`,
    );
    lines.push("");
    lines.push(`| Route | Status | Final URL | Body chars | Issues |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const e of entries) {
      const issueCount = e.issues?.length ?? 0;
      const status = e.httpStatus ?? "—";
      const final = e.finalUrl ? e.finalUrl.replace(BASE_URL, "") : "—";
      const body = e.bodyLength ?? 0;
      lines.push(`| ${e.route} | ${status} | ${final} | ${body} | ${issueCount} |`);
    }
    lines.push("");
  }

  lines.push(`## Detailed Issues`);
  lines.push("");
  if (data.issues.length === 0) {
    lines.push("No issues detected.");
  } else {
    lines.push(`| Severity | Category | Page | Title | Detail |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const i of data.issues) {
      const detail = (i.detail || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const title = (i.title || "").replace(/\|/g, "\\|");
      lines.push(
        `| ${i.severity} | ${i.category} | ${i.page} | ${title} | ${detail.slice(0, 200)} |`,
      );
    }
  }
  lines.push("");

  lines.push(`## How to Reproduce`);
  lines.push("");
  lines.push(`Run the same audit locally:`);
  lines.push("");
  lines.push(`\`\`\`bash`);
  lines.push(`export PATH=/home/ubuntu/.n/bin:$PATH`);
  lines.push(
    `E2E_BASE_URL=https://oltigo.com ADMIN_EMAIL=admin@admin.com ADMIN_PASSWORD=123456789 node scripts/oltigo-production-audit.mjs`,
  );
  lines.push(`\`\`\``);
  lines.push("");
  return lines.join("\n");
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
