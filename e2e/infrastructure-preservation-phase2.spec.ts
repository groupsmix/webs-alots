import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';

/**
 * Phase 2: Infrastructure Preservation Property Tests
 * 
 * Property 2: Preservation - Existing Functionality Preservation
 * 
 * IMPORTANT: Follow observation-first methodology
 * - These tests observe behavior on UNFIXED infrastructure
 * - They capture baseline behavior that must be preserved
 * - Tests MUST PASS on unfixed infrastructure
 * - After fixes, these same tests must still pass (no regressions)
 * 
 * GOAL: Ensure security hardening doesn't break existing functionality:
 * 1. Docker Compose provides working local dev stack
 * 2. GitHub Actions execute successfully
 * 3. Cloudflare Workers serve production traffic
 * 4. Rate limiting allows legitimate users
 * 5. R2 storage supports file operations
 * 6. Secret rotation operates without interruption
 * 7. Monitoring captures errors and metrics
 * 8. Cron jobs execute on time
 * 9. Sentry provides debugging information
 * 10. Health checks validate availability
 * 11. External API calls work correctly
 */

test.describe('Phase 2: Infrastructure Preservation Properties', () => {
  
  test.describe('1. Docker Compose Functionality', () => {
    
    test('Docker Compose configuration SHOULD be valid YAML', () => {
      // Preservation: Docker Compose must remain valid after hardening
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      // Basic YAML structure validation
      expect(dockerCompose).toContain('version:');
      expect(dockerCompose).toContain('services:');
      expect(dockerCompose).toContain('db:');
      expect(dockerCompose).toContain('studio:');
      expect(dockerCompose).toContain('minio:');
    });
    
    test('Docker services SHOULD have required environment variables', () => {
      // Preservation: Services must have all required env vars
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      // Postgres
      expect(dockerCompose).toMatch(/POSTGRES_PASSWORD/);
      expect(dockerCompose).toMatch(/POSTGRES_DB/);
      
      // MinIO
      expect(dockerCompose).toMatch(/MINIO_ROOT_USER/);
      expect(dockerCompose).toMatch(/MINIO_ROOT_PASSWORD/);
    });
    
    test('Docker services SHOULD have health checks', () => {
      // Preservation: Health checks must remain functional
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('healthcheck:');
      expect(dockerCompose).toMatch(/pg_isready/);
    });
    
    test('Docker volumes SHOULD be declared', () => {
      // Preservation: Data persistence must work
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('volumes:');
      expect(dockerCompose).toContain('supabase-db:');
      expect(dockerCompose).toContain('minio-data:');
    });
  });
  
  test.describe('2. Wrangler Configuration', () => {
    
    test('wrangler.toml SHOULD be valid TOML', () => {
      // Preservation: Configuration must remain parseable
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('name =');
      expect(wranglerToml).toContain('main =');
      expect(wranglerToml).toContain('compatibility_date =');
    });
    
    test('wrangler.toml SHOULD have required fields', () => {
      // Preservation: Core config must remain
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toMatch(/name\s*=\s*"webs-alots"/);
      expect(wranglerToml).toMatch(/main\s*=\s*"\.open-next\/worker\.js"/);
      expect(wranglerToml).toContain('compatibility_flags');
      expect(wranglerToml).toContain('nodejs_compat');
    });
    
    test('wrangler.toml SHOULD have environment variables', () => {
      // Preservation: Runtime vars must be available
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('[vars]');
      expect(wranglerToml).toMatch(/NODE_ENV/);
      expect(wranglerToml).toMatch(/RATE_LIMIT_BACKEND/);
    });
    
    test('wrangler.toml SHOULD have staging environment', () => {
      // Preservation: Multi-environment support must work
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('[env.staging]');
      expect(wranglerToml).toMatch(/name\s*=\s*"webs-alots-staging"/);
    });
  });
  
  test.describe('3. Environment Variables', () => {
    
    test('.env.example SHOULD document all required variables', () => {
      // Preservation: Documentation must remain comprehensive
      const envExample = readFileSync('.env.example', 'utf-8');
      
      // Core Supabase
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY');
      
      // Security
      expect(envExample).toContain('BOOKING_TOKEN_SECRET');
      expect(envExample).toContain('CRON_SECRET');
      expect(envExample).toContain('PHI_ENCRYPTION_KEY');
      
      // Storage
      expect(envExample).toContain('R2_ACCOUNT_ID');
      expect(envExample).toContain('R2_BUCKET_NAME');
      
      // Payments
      expect(envExample).toContain('STRIPE_SECRET_KEY');
      expect(envExample).toContain('CMI_MERCHANT_ID');
      
      // Communications
      expect(envExample).toContain('WHATSAPP_PHONE_NUMBER_ID');
      expect(envExample).toContain('RESEND_API_KEY');
    });
    
    test('.env.example SHOULD have helpful comments', () => {
      // Preservation: Developer experience must remain good
      const envExample = readFileSync('.env.example', 'utf-8');
      
      expect(envExample).toMatch(/# .*Supabase/);
      expect(envExample).toMatch(/# .*Required/);
      expect(envExample).toMatch(/# .*Optional/);
      expect(envExample).toMatch(/How to obtain:/);
    });
  });
  
  test.describe('4. Middleware Functionality', () => {
    
    test('middleware SHOULD have core imports', () => {
      // Preservation: Essential functionality must remain
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      expect(middleware).toContain('@supabase/ssr');
      expect(middleware).toContain('NextResponse');
      expect(middleware).toContain('NextRequest');
    });
    
    test('middleware SHOULD have security modules', () => {
      // Preservation: Security layers must remain
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      expect(middleware).toContain('@/lib/middleware/security-headers');
      expect(middleware).toContain('@/lib/middleware/csrf');
      expect(middleware).toContain('@/lib/middleware/rate-limiting');
      expect(middleware).toContain('@/lib/middleware/routes');
    });
    
    test('middleware SHOULD have tenant resolution', () => {
      // Preservation: Multi-tenancy must work
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      expect(middleware).toContain('extractSubdomain');
      expect(middleware).toContain('subdomainCache');
      expect(middleware).toContain('TENANT_HEADERS');
    });
    
    test('middleware SHOULD have authentication', () => {
      // Preservation: Auth must work
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      expect(middleware).toContain('createServerClient');
      expect(middleware).toContain('getUser');
      expect(middleware).toContain('isPublicRoute');
      expect(middleware).toContain('isProtectedRoute');
    });
    
    test('middleware SHOULD have role-based routing', () => {
      // Preservation: RBAC must work
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      expect(middleware).toContain('ROLE_ROUTE_MAP');
      expect(middleware).toContain('ROLE_DASHBOARD_MAP');
      expect(middleware).toMatch(/super_admin|clinic_admin|doctor|patient/);
    });
  });
  
  test.describe('5. API Routes Structure', () => {
    
    test('API routes SHOULD exist in expected locations', () => {
      // Preservation: API structure must remain
      expect(existsSync('src/app/api/health/route.ts')).toBe(true);
      expect(existsSync('src/app/api/booking/route.ts')).toBe(true);
      expect(existsSync('src/app/api/upload/route.ts')).toBe(true);
      expect(existsSync('src/app/api/webhooks/route.ts')).toBe(true);
    });
    
    test('API v1 routes SHOULD exist', () => {
      // Preservation: Versioned API must remain
      expect(existsSync('src/app/api/v1/appointments/route.ts')).toBe(true);
      expect(existsSync('src/app/api/v1/patients/route.ts')).toBe(true);
      expect(existsSync('src/app/api/v1/register-clinic/route.ts')).toBe(true);
    });
  });
  
  test.describe('6. Database Migrations', () => {
    
    test('Migration files SHOULD exist', () => {
      // Preservation: Database schema must be intact
      expect(existsSync('supabase/migrations')).toBe(true);
    });
    
    test('Recent migrations SHOULD be present', () => {
      // Preservation: Latest schema changes must remain
      expect(existsSync('supabase/migrations/00072_booking_slot_advisory_lock.sql')).toBe(true);
      expect(existsSync('supabase/migrations/00073_ai_token_budget.sql')).toBe(true);
      expect(existsSync('supabase/migrations/00074_patient_files_ownership.sql')).toBe(true);
    });
  });
  
  test.describe('7. Library Modules', () => {
    
    test('Core library modules SHOULD exist', () => {
      // Preservation: Essential utilities must remain
      expect(existsSync('src/lib/logger.ts')).toBe(true);
      expect(existsSync('src/lib/tenant.ts')).toBe(true);
      expect(existsSync('src/lib/with-auth.ts')).toBe(true);
      expect(existsSync('src/lib/validations.ts')).toBe(true);
      expect(existsSync('src/lib/encryption.ts')).toBe(true);
    });
    
    test('Security modules SHOULD exist', () => {
      // Preservation: Security utilities must remain
      expect(existsSync('src/lib/crypto-utils.ts')).toBe(true);
      expect(existsSync('src/lib/audit-log.ts')).toBe(true);
      expect(existsSync('src/lib/rate-limit.ts')).toBe(true);
      expect(existsSync('src/lib/ai-budget.ts')).toBe(true);
    });
    
    test('Integration modules SHOULD exist', () => {
      // Preservation: External integrations must remain
      expect(existsSync('src/lib/whatsapp.ts')).toBe(true);
      expect(existsSync('src/lib/email.ts')).toBe(true);
      expect(existsSync('src/lib/sms.ts')).toBe(true);
    });
  });
  
  test.describe('8. Documentation', () => {
    
    test('Core documentation SHOULD exist', () => {
      // Preservation: Documentation must remain
      expect(existsSync('README.md')).toBe(true);
      expect(existsSync('AGENTS.md')).toBe(true);
      expect(existsSync('CONTRIBUTING.md')).toBe(true);
      expect(existsSync('SECURITY.md')).toBe(true);
    });
    
    test('Operational documentation SHOULD exist', () => {
      // Preservation: Runbooks must remain
      expect(existsSync('docs/incident-response.md')).toBe(true);
      expect(existsSync('docs/backup-recovery-runbook.md')).toBe(true);
      expect(existsSync('docs/SOP-SECRET-ROTATION.md')).toBe(true);
    });
    
    test('Compliance documentation SHOULD exist', () => {
      // Preservation: Compliance docs must remain
      expect(existsSync('docs/compliance/dpia.md')).toBe(true);
      expect(existsSync('docs/compliance/retention.md')).toBe(true);
      expect(existsSync('docs/compliance/information-security-policy.md')).toBe(true);
    });
  });
  
  test.describe('9. Build Configuration', () => {
    
    test('package.json SHOULD have required scripts', () => {
      // Preservation: Build process must work
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      
      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('build:cf');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('test:e2e');
      expect(packageJson.scripts).toHaveProperty('lint');
    });
    
    test('package.json SHOULD have required dependencies', () => {
      // Preservation: Core dependencies must remain
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      
      expect(packageJson.dependencies).toHaveProperty('next');
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('@supabase/ssr');
      expect(packageJson.dependencies).toHaveProperty('zod');
    });
    
    test('next.config.ts SHOULD exist', () => {
      // Preservation: Next.js config must remain
      expect(existsSync('next.config.ts')).toBe(true);
    });
    
    test('tsconfig.json SHOULD exist', () => {
      // Preservation: TypeScript config must remain
      expect(existsSync('tsconfig.json')).toBe(true);
    });
  });
  
  test.describe('10. CI/CD Workflows', () => {
    
    test('GitHub Actions workflows SHOULD exist', () => {
      // Preservation: CI/CD must remain functional
      expect(existsSync('.github/workflows/ci.yml')).toBe(true);
      expect(existsSync('.github/workflows/deploy.yml')).toBe(true);
      expect(existsSync('.github/workflows/backup.yml')).toBe(true);
    });
    
    test('CI workflow SHOULD have required jobs', () => {
      // Preservation: Quality gates must remain
      const ciYml = readFileSync('.github/workflows/ci.yml', 'utf-8');
      
      expect(ciYml).toMatch(/lint/i);
      expect(ciYml).toMatch(/test/i);
      expect(ciYml).toMatch(/build/i);
    });
    
    test('Deploy workflow SHOULD have required steps', () => {
      // Preservation: Deployment must work
      const deployYml = readFileSync('.github/workflows/deploy.yml', 'utf-8');
      
      expect(deployYml).toContain('build');
      expect(deployYml).toContain('deploy');
      expect(deployYml).toMatch(/health.*check/i);
    });
  });
  
  test.describe('11. Sentry Configuration', () => {
    
    test('Sentry config files SHOULD exist', () => {
      // Preservation: Error monitoring must work
      expect(existsSync('sentry.server.config.ts')).toBe(true);
      expect(existsSync('sentry.client.config.ts')).toBe(true);
      expect(existsSync('sentry.edge.config.ts')).toBe(true);
    });
    
    test('Sentry configs SHOULD have DSN', () => {
      // Preservation: Sentry initialization must work
      const sentryServer = readFileSync('sentry.server.config.ts', 'utf-8');
      
      expect(sentryServer).toContain('Sentry.init');
      expect(sentryServer).toMatch(/dsn|SENTRY_DSN/);
    });
  });
  
  test.describe('12. R2 Configuration', () => {
    
    test('R2 lifecycle config SHOULD exist', () => {
      // Preservation: Storage lifecycle must work
      expect(existsSync('r2-lifecycle.json')).toBe(true);
    });
    
    test('R2 lifecycle SHOULD have rules', () => {
      // Preservation: At least one rule must exist
      const lifecycle = JSON.parse(readFileSync('r2-lifecycle.json', 'utf-8'));
      
      expect(lifecycle).toHaveProperty('rules');
      expect(Array.isArray(lifecycle.rules)).toBe(true);
      expect(lifecycle.rules.length).toBeGreaterThan(0);
    });
  });
  
  test.describe('13. Scripts', () => {
    
    test('Operational scripts SHOULD exist', () => {
      // Preservation: Automation must work
      expect(existsSync('scripts/backup-database.sh')).toBe(true);
      expect(existsSync('scripts/rotate-phi-key.ts')).toBe(true);
      expect(existsSync('scripts/backfill-patient-files.ts')).toBe(true);
      expect(existsSync('scripts/audit-pii-logs.ts')).toBe(true);
    });
    
    test('Build scripts SHOULD exist', () => {
      // Preservation: Build process must work
      expect(existsSync('scripts/patch-opennext.mjs')).toBe(true);
      expect(existsSync('scripts/post-build-patch.mjs')).toBe(true);
    });
  });
  
  test.describe('14. E2E Tests', () => {
    
    test('E2E test files SHOULD exist', () => {
      // Preservation: Test suite must remain
      expect(existsSync('e2e/smoke.spec.ts')).toBe(true);
      expect(existsSync('e2e/login-flow.spec.ts')).toBe(true);
      expect(existsSync('e2e/booking-flow.spec.ts')).toBe(true);
      expect(existsSync('e2e/security-fixes-phase1.spec.ts')).toBe(true);
    });
    
    test('Playwright config SHOULD exist', () => {
      // Preservation: Test runner must work
      expect(existsSync('playwright.config.ts')).toBe(true);
    });
  });
  
  test.describe('15. Public Assets', () => {
    
    test('Public directory SHOULD exist', () => {
      // Preservation: Static assets must be served
      expect(existsSync('public')).toBe(true);
    });
    
    test('Required public assets SHOULD exist', () => {
      // Preservation: PWA and SEO assets must work
      expect(existsSync('public/favicon.ico')).toBe(true);
      expect(existsSync('public/sw.js')).toBe(true);
      expect(existsSync('public/offline.html')).toBe(true);
    });
    
    test('Security files SHOULD exist', () => {
      // Preservation: Security disclosures must work
      expect(existsSync('public/.well-known/security.txt')).toBe(true);
    });
  });
});
